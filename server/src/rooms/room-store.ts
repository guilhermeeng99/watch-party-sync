import { randomUUID } from "node:crypto";
import {
  type ControlRequest,
  DEFAULT_SYNC_OPTIONS,
  type MediaKey,
  type MemberRole,
  type MemberSnapshot,
  type PlaybackCommand,
  type PlayerState,
  type ProviderId,
  type RoomCreatePayload,
  type RoomMode,
  type RoomSnapshot,
  canRequestControl,
  mediaKeysEqual,
  normalizeRoomCode,
} from "@watch-party-sync/protocol";

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// Derive the command's paused flag from the control type. play/seek always resume, pause always
// pauses, and a rate change preserves whatever pause state the issuer was already in.
function resolvePaused(type: ControlRequest["type"], basePaused: boolean): boolean {
  if (type === "pause") {
    return true;
  }

  if (type === "rate") {
    return basePaused;
  }

  return false;
}

export type RoomStoreOptions = {
  roomTtlMs: number;
  emptyRoomTtlMs: number;
  commandDelayMs?: number;
  now?: () => number;
};

export type RoomEvent =
  | { type: "snapshot"; roomCode: string; snapshot: RoomSnapshot }
  | { type: "command"; roomCode: string; command: PlaybackCommand }
  | { type: "closed"; roomCode: string; reason: string };

type RoomMember = {
  memberId: string;
  socketId: string;
  displayName: string;
  role: MemberRole;
  ready: boolean;
  connected: boolean;
  providerId?: ProviderId;
  mediaKey?: MediaKey;
  lastState?: PlayerState;
  joinedAt: number;
  lastSeenAt: number;
};

type Room = {
  code: string;
  createdAt: number;
  expiresAt: number;
  emptySince?: number;
  mode: RoomMode;
  hostMemberId: string;
  mediaKey?: MediaKey;
  members: Map<string, RoomMember>;
  lastCommand?: PlaybackCommand;
};

export type StoreResult<T> = { ok: true; value: T; events: RoomEvent[] } | StoreError;
export type StoreError = { ok: false; code: string; message: string };

export class RoomStore {
  private readonly rooms = new Map<string, Room>();
  private readonly now: () => number;
  private readonly roomTtlMs: number;
  private readonly emptyRoomTtlMs: number;
  private readonly commandDelayMs: number;

  constructor(options: RoomStoreOptions) {
    this.now = options.now ?? Date.now;
    this.roomTtlMs = options.roomTtlMs;
    this.emptyRoomTtlMs = options.emptyRoomTtlMs;
    this.commandDelayMs = options.commandDelayMs ?? DEFAULT_SYNC_OPTIONS.commandDelayMs;
  }

  createRoom(payload: RoomCreatePayload, socketId: string): StoreResult<RoomSnapshot> {
    const now = this.now();
    const code = this.createUniqueCode();
    const memberId = payload.memberId ?? randomUUID();
    const member = this.createMember(payload.displayName, memberId, socketId, "host", now, {
      providerId: payload.providerId,
      mediaKey: payload.mediaKey,
    });

    const room: Room = {
      code,
      createdAt: now,
      expiresAt: now + this.roomTtlMs,
      mode: payload.mode ?? "friend",
      hostMemberId: memberId,
      mediaKey: payload.mediaKey,
      members: new Map([[memberId, member]]),
    };

    this.rooms.set(code, room);
    const snapshot = this.snapshot(room);
    return { ok: true, value: snapshot, events: [{ type: "snapshot", roomCode: code, snapshot }] };
  }

  joinRoom(
    payload: {
      roomCode: string;
      memberId?: string;
      displayName: string;
      providerId?: ProviderId;
      mediaKey?: MediaKey;
    },
    socketId: string,
  ): StoreResult<RoomSnapshot> {
    const room = this.getLiveRoom(payload.roomCode);
    if (!room) {
      return this.error("room_not_found", "Room not found.");
    }

    if (room.mediaKey && payload.mediaKey && !mediaKeysEqual(room.mediaKey, payload.mediaKey)) {
      return this.error("media_mismatch", "This room is watching a different video.");
    }

    const now = this.now();
    const memberId = payload.memberId ?? randomUUID();
    const existing = room.members.get(memberId);

    if (existing) {
      existing.socketId = socketId;
      existing.connected = true;
      existing.displayName = payload.displayName;
      existing.providerId = payload.providerId;
      existing.mediaKey = payload.mediaKey;
      existing.lastSeenAt = now;
    } else {
      room.members.set(
        memberId,
        this.createMember(payload.displayName, memberId, socketId, "member", now, {
          providerId: payload.providerId,
          mediaKey: payload.mediaKey,
        }),
      );
    }

    const snapshot = this.snapshot(room);
    return {
      ok: true,
      value: snapshot,
      events: [{ type: "snapshot", roomCode: room.code, snapshot }],
    };
  }

  markReady(
    roomCode: string,
    memberId: string,
    ready: boolean,
    state?: PlayerState,
  ): StoreResult<RoomSnapshot> {
    const found = this.findMember(roomCode, memberId);
    if (!found.ok) {
      return found;
    }

    const { room, member } = found.value;
    member.ready = ready;
    member.lastSeenAt = this.now();

    if (state) {
      this.applyState(room, member, state);
    }

    const snapshot = this.snapshot(room);
    return {
      ok: true,
      value: snapshot,
      events: [{ type: "snapshot", roomCode: room.code, snapshot }],
    };
  }

  updatePlayerState(
    roomCode: string,
    memberId: string,
    state: PlayerState,
  ): StoreResult<RoomSnapshot> {
    const found = this.findMember(roomCode, memberId);
    if (!found.ok) {
      return found;
    }

    const { room, member } = found.value;
    this.applyState(room, member, state);
    const snapshot = this.snapshot(room);
    return {
      ok: true,
      value: snapshot,
      events: [{ type: "snapshot", roomCode: room.code, snapshot }],
    };
  }

  requestControl(request: ControlRequest): StoreResult<PlaybackCommand> {
    const found = this.findMember(request.roomCode, request.memberId);
    if (!found.ok) {
      return found;
    }

    const { room, member } = found.value;
    if (!canRequestControl(room.mode, member.role, request.type)) {
      return this.error("forbidden", "You cannot control playback in this room mode.");
    }

    const mediaKey = room.mediaKey ?? member.mediaKey ?? member.lastState?.mediaKey;
    if (!mediaKey) {
      return this.error("media_required", "No media is attached to this room yet.");
    }

    const issuedAt = this.now();
    const baseState = member.lastState;
    const position = request.position ?? baseState?.currentTime ?? 0;
    const playbackRate = request.playbackRate ?? baseState?.playbackRate ?? 1;
    const command: PlaybackCommand = {
      commandId: randomUUID(),
      type: request.type,
      mediaKey,
      position,
      playbackRate,
      paused: resolvePaused(request.type, baseState?.paused ?? false),
      issuedAt,
      applyAt: issuedAt + this.commandDelayMs,
      issuerMemberId: member.memberId,
      reason: "user",
    };

    room.lastCommand = command;
    const snapshot = this.snapshot(room);
    return {
      ok: true,
      value: command,
      events: [
        { type: "command", roomCode: room.code, command },
        { type: "snapshot", roomCode: room.code, snapshot },
      ],
    };
  }

  disconnectSocket(socketId: string): RoomEvent[] {
    const events: RoomEvent[] = [];
    const now = this.now();

    for (const room of this.rooms.values()) {
      let changed = false;
      for (const member of room.members.values()) {
        if (member.socketId === socketId) {
          member.connected = false;
          member.ready = false;
          member.lastSeenAt = now;
          changed = true;
        }
      }

      if (changed) {
        if (this.connectedMembers(room).length === 0) {
          room.emptySince = now;
        }
        events.push({ type: "snapshot", roomCode: room.code, snapshot: this.snapshot(room) });
      }
    }

    return events;
  }

  cleanupExpiredRooms(): RoomEvent[] {
    const events: RoomEvent[] = [];
    const now = this.now();

    for (const [code, room] of this.rooms) {
      const expired = now >= room.expiresAt;
      const emptyExpired =
        room.emptySince !== undefined && now - room.emptySince >= this.emptyRoomTtlMs;

      if (expired || emptyExpired) {
        this.rooms.delete(code);
        events.push({ type: "closed", roomCode: code, reason: expired ? "expired" : "empty" });
      }
    }

    return events;
  }

  getSnapshot(roomCode: string): StoreResult<RoomSnapshot> {
    const room = this.getLiveRoom(roomCode);
    if (!room) {
      return this.error("room_not_found", "Room not found.");
    }

    return { ok: true, value: this.snapshot(room), events: [] };
  }

  private applyState(room: Room, member: RoomMember, state: PlayerState) {
    member.lastState = state;
    member.providerId = state.mediaKey.providerId;
    member.mediaKey = state.mediaKey;
    member.lastSeenAt = this.now();

    if (!room.mediaKey) {
      room.mediaKey = state.mediaKey;
    }
  }

  private createMember(
    displayName: string,
    memberId: string,
    socketId: string,
    role: MemberRole,
    now: number,
    media: { providerId?: ProviderId; mediaKey?: MediaKey },
  ): RoomMember {
    return {
      memberId,
      socketId,
      displayName,
      role,
      ready: false,
      connected: true,
      providerId: media.providerId,
      mediaKey: media.mediaKey,
      joinedAt: now,
      lastSeenAt: now,
    };
  }

  private findMember(
    roomCode: string,
    memberId: string,
  ): StoreResult<{ room: Room; member: RoomMember }> {
    const room = this.getLiveRoom(roomCode);
    if (!room) {
      return this.error("room_not_found", "Room not found.");
    }

    const member = room.members.get(memberId);
    if (!member) {
      return this.error("member_not_found", "Member not found in room.");
    }

    return { ok: true, value: { room, member }, events: [] };
  }

  private getLiveRoom(roomCode: string): Room | undefined {
    const room = this.rooms.get(normalizeRoomCode(roomCode));
    if (!room || this.now() >= room.expiresAt) {
      return undefined;
    }

    return room;
  }

  private snapshot(room: Room): RoomSnapshot {
    return {
      code: room.code,
      mode: room.mode,
      hostMemberId: room.hostMemberId,
      mediaKey: room.mediaKey,
      members: [...room.members.values()].map((member) => this.memberSnapshot(member)),
      lastCommand: room.lastCommand,
      serverTime: this.now(),
    };
  }

  private memberSnapshot(member: RoomMember): MemberSnapshot {
    return {
      memberId: member.memberId,
      displayName: member.displayName,
      role: member.role,
      ready: member.ready,
      connected: member.connected,
      providerId: member.providerId,
      mediaKey: member.mediaKey,
      lastState: member.lastState,
      joinedAt: member.joinedAt,
      lastSeenAt: member.lastSeenAt,
    };
  }

  private connectedMembers(room: Room) {
    return [...room.members.values()].filter((member) => member.connected);
  }

  private createUniqueCode(): string {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const code = Array.from(
        { length: 6 },
        () => ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)],
      ).join("");

      if (!this.rooms.has(code)) {
        return code;
      }
    }

    return randomUUID().slice(0, 8).toUpperCase();
  }

  private error(code: string, message: string): StoreError {
    return { ok: false, code, message };
  }
}
