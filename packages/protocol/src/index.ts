import { z } from "zod";

export const PROVIDER_IDS = [
  "youtube",
  "generic-html5",
  "crunchyroll",
  "netflix",
  "prime-video",
] as const;

export const ProviderIdSchema = z.enum(PROVIDER_IDS);
export type ProviderId = z.infer<typeof ProviderIdSchema>;

export const RoomModeSchema = z.enum(["friend", "host"]);
export type RoomMode = z.infer<typeof RoomModeSchema>;

export const MemberRoleSchema = z.enum(["host", "member"]);
export type MemberRole = z.infer<typeof MemberRoleSchema>;

export const MediaKeySchema = z
  .object({
    providerId: ProviderIdSchema,
    id: z.string().min(1).max(500),
    url: z.string().url().optional(),
    title: z.string().max(300).optional(),
  })
  .strict();
export type MediaKey = z.infer<typeof MediaKeySchema>;

export const PlayerStateSchema = z
  .object({
    mediaKey: MediaKeySchema,
    paused: z.boolean(),
    currentTime: z.number().finite().nonnegative(),
    duration: z.number().finite().positive().optional(),
    playbackRate: z.number().finite().positive().max(16),
    bufferedEnd: z.number().finite().nonnegative().optional(),
    capturedAt: z.number().finite().nonnegative(),
  })
  .strict();
export type PlayerState = z.infer<typeof PlayerStateSchema>;

export const MemberSnapshotSchema = z
  .object({
    memberId: z.string().min(1),
    displayName: z.string().min(1).max(40),
    role: MemberRoleSchema,
    ready: z.boolean(),
    connected: z.boolean(),
    providerId: ProviderIdSchema.optional(),
    mediaKey: MediaKeySchema.optional(),
    lastState: PlayerStateSchema.optional(),
    joinedAt: z.number().finite().nonnegative(),
    lastSeenAt: z.number().finite().nonnegative(),
  })
  .strict();
export type MemberSnapshot = z.infer<typeof MemberSnapshotSchema>;

export const PlaybackCommandTypeSchema = z.enum(["play", "pause", "seek", "rate", "sync"]);
export type PlaybackCommandType = z.infer<typeof PlaybackCommandTypeSchema>;

export const PlaybackCommandSchema = z
  .object({
    commandId: z.string().min(1),
    type: PlaybackCommandTypeSchema,
    mediaKey: MediaKeySchema,
    position: z.number().finite().nonnegative(),
    playbackRate: z.number().finite().positive().max(16),
    paused: z.boolean(),
    issuedAt: z.number().finite().nonnegative(),
    applyAt: z.number().finite().nonnegative(),
    issuerMemberId: z.string().min(1),
    reason: z.enum(["user", "drift", "join", "reconnect"]),
  })
  .strict();
export type PlaybackCommand = z.infer<typeof PlaybackCommandSchema>;

export const RoomSnapshotSchema = z
  .object({
    code: z.string().min(3).max(16),
    mode: RoomModeSchema,
    hostMemberId: z.string().min(1),
    mediaKey: MediaKeySchema.optional(),
    members: z.array(MemberSnapshotSchema),
    lastCommand: PlaybackCommandSchema.optional(),
    serverTime: z.number().finite().nonnegative(),
  })
  .strict();
export type RoomSnapshot = z.infer<typeof RoomSnapshotSchema>;

export const RoomCreatePayloadSchema = z
  .object({
    memberId: z.string().min(1).optional(),
    displayName: z.string().min(1).max(40),
    mode: RoomModeSchema.default("friend"),
    providerId: ProviderIdSchema.optional(),
    mediaKey: MediaKeySchema.optional(),
  })
  .strict();
export type RoomCreatePayload = z.input<typeof RoomCreatePayloadSchema>;

export const RoomJoinPayloadSchema = z
  .object({
    roomCode: z.string().min(3).max(16),
    memberId: z.string().min(1).optional(),
    displayName: z.string().min(1).max(40),
    providerId: ProviderIdSchema.optional(),
    mediaKey: MediaKeySchema.optional(),
  })
  .strict();
export type RoomJoinPayload = z.infer<typeof RoomJoinPayloadSchema>;

export const MemberReadyPayloadSchema = z
  .object({
    roomCode: z.string().min(3).max(16),
    memberId: z.string().min(1),
    ready: z.boolean(),
    state: PlayerStateSchema.optional(),
  })
  .strict();
export type MemberReadyPayload = z.infer<typeof MemberReadyPayloadSchema>;

export const PlayerStatePayloadSchema = z
  .object({
    roomCode: z.string().min(3).max(16),
    memberId: z.string().min(1),
    state: PlayerStateSchema,
  })
  .strict();
export type PlayerStatePayload = z.infer<typeof PlayerStatePayloadSchema>;

export const ControlRequestSchema = z
  .object({
    roomCode: z.string().min(3).max(16),
    memberId: z.string().min(1),
    type: PlaybackCommandTypeSchema.exclude(["sync"]),
    position: z.number().finite().nonnegative().optional(),
    playbackRate: z.number().finite().positive().max(16).optional(),
  })
  .strict();
export type ControlRequest = z.infer<typeof ControlRequestSchema>;

export const AckSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), snapshot: RoomSnapshotSchema.optional() }).strict(),
  z.object({ ok: z.literal(false), code: z.string(), message: z.string() }).strict(),
]);
export type Ack = z.infer<typeof AckSchema>;

export type DriftDecision = "none" | "rate-nudge" | "seek";

export type SyncOptions = {
  commandDelayMs: number;
  smallDriftMs: number;
  largeDriftMs: number;
  maxRateNudge: number;
};

export const DEFAULT_SYNC_OPTIONS: SyncOptions = {
  commandDelayMs: 1500,
  smallDriftMs: 250,
  largeDriftMs: 1500,
  maxRateNudge: 0.05,
};

export function calculateTargetPosition(command: PlaybackCommand, nowServerMs: number): number {
  if (command.paused) {
    return command.position;
  }

  const elapsedSeconds = Math.max(0, nowServerMs - command.applyAt) / 1000;
  return command.position + elapsedSeconds * command.playbackRate;
}

export function classifyDrift(
  driftMs: number,
  paused: boolean,
  options: SyncOptions = DEFAULT_SYNC_OPTIONS,
): DriftDecision {
  const absoluteDrift = Math.abs(driftMs);

  if (absoluteDrift <= options.smallDriftMs) {
    return "none";
  }

  if (paused || absoluteDrift > options.largeDriftMs) {
    return "seek";
  }

  return "rate-nudge";
}

export function calculateNudgedRate(
  baseRate: number,
  driftMs: number,
  options: SyncOptions = DEFAULT_SYNC_OPTIONS,
): number {
  if (Math.abs(driftMs) <= options.smallDriftMs) {
    return baseRate;
  }

  const direction = driftMs < 0 ? 1 : -1;
  const nudge = Math.min(options.maxRateNudge, Math.abs(driftMs) / 10_000);
  return roundRate(baseRate + direction * nudge);
}

export function estimateClockOffset(
  clientSendAt: number,
  serverAt: number,
  clientReceiveAt: number,
) {
  const rtt = clientReceiveAt - clientSendAt;
  const offset = serverAt - (clientSendAt + rtt / 2);
  return { rtt, offset };
}

export function canRequestControl(
  mode: RoomMode,
  role: MemberRole,
  type: PlaybackCommandType,
): boolean {
  if (role === "host") {
    return true;
  }

  if (mode === "friend") {
    return type === "play" || type === "pause" || type === "rate";
  }

  return false;
}

export function mediaKeysEqual(left?: MediaKey, right?: MediaKey): boolean {
  if (!left || !right) {
    return false;
  }

  return left.providerId === right.providerId && left.id === right.id;
}

export function normalizeRoomCode(code: string): string {
  return code.trim().toUpperCase();
}

function roundRate(rate: number): number {
  return Math.round(rate * 1000) / 1000;
}
