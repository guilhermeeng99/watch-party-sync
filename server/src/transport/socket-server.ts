import type { Server as HttpServer } from "node:http";
import {
  ControlRequestSchema,
  MemberReadyPayloadSchema,
  PlayerStatePayloadSchema,
  RoomCreatePayloadSchema,
  RoomJoinPayloadSchema,
  normalizeRoomCode,
} from "@watch-party-sync/protocol";
import { Server } from "socket.io";
import type { Env } from "../config/env.js";
import { type RoomEvent, RoomStore, type StoreError } from "../rooms/room-store.js";

type AckFn = (payload: unknown) => void;

export function createSocketServer(httpServer: HttpServer, env: Env) {
  const io = new Server(httpServer, {
    cors: {
      origin: parseCorsOrigin(env.CORS_ORIGIN),
    },
  });
  const namespace = io.of("/rooms");
  const store = new RoomStore({
    roomTtlMs: env.ROOM_TTL_SECONDS * 1000,
    emptyRoomTtlMs: env.EMPTY_ROOM_TTL_SECONDS * 1000,
    commandDelayMs: env.COMMAND_DELAY_MS,
  });

  namespace.on("connection", (socket) => {
    socket.on("room:create", (raw, ack?: AckFn) => {
      const payload = RoomCreatePayloadSchema.safeParse(raw);
      if (!payload.success) {
        return ackError(ack, "invalid_payload", "Invalid room payload.");
      }

      const result = store.createRoom(payload.data, socket.id);
      if (!result.ok) {
        return ackStoreError(ack, result);
      }

      socket.join(result.value.code);
      emitEvents(namespace, result.events);
      return ack?.({ ok: true, snapshot: result.value });
    });

    socket.on("room:join", (raw, ack?: AckFn) => {
      const payload = RoomJoinPayloadSchema.safeParse(raw);
      if (!payload.success) {
        return ackError(ack, "invalid_payload", "Invalid join payload.");
      }

      const result = store.joinRoom(payload.data, socket.id);
      if (!result.ok) {
        return ackStoreError(ack, result);
      }

      socket.join(result.value.code);
      emitEvents(namespace, result.events);
      return ack?.({ ok: true, snapshot: result.value });
    });

    socket.on("member:ready", (raw, ack?: AckFn) => {
      const payload = MemberReadyPayloadSchema.safeParse(raw);
      if (!payload.success) {
        return ackError(ack, "invalid_payload", "Invalid ready payload.");
      }

      const result = store.markReady(
        payload.data.roomCode,
        payload.data.memberId,
        payload.data.ready,
        payload.data.state,
      );
      if (!result.ok) {
        return ackStoreError(ack, result);
      }

      emitEvents(namespace, result.events);
      return ack?.({ ok: true, snapshot: result.value });
    });

    socket.on("player:state", (raw) => {
      const payload = PlayerStatePayloadSchema.safeParse(raw);
      if (!payload.success) {
        socket.emit("room:error", { code: "invalid_payload", message: "Invalid player state." });
        return;
      }

      const result = store.updatePlayerState(
        payload.data.roomCode,
        payload.data.memberId,
        payload.data.state,
      );
      if (result.ok) {
        emitEvents(namespace, result.events);
      }
    });

    socket.on("control:request", (raw, ack?: AckFn) => {
      const payload = ControlRequestSchema.safeParse(raw);
      if (!payload.success) {
        return ackError(ack, "invalid_payload", "Invalid control payload.");
      }

      const result = store.requestControl(payload.data);
      if (!result.ok) {
        return ackStoreError(ack, result);
      }

      emitEvents(namespace, result.events);
      return ack?.({ ok: true });
    });

    socket.on("clock:ping", (raw: unknown, ack?: AckFn) => {
      // Echo the client's timestamp back so it can estimate the round trip; fall back to our own
      // clock if the boundary value isn't a finite number rather than echoing garbage.
      const clientSentAt = typeof raw === "number" && Number.isFinite(raw) ? raw : Date.now();
      ack?.({ clientSentAt, serverAt: Date.now() });
    });

    socket.on("room:snapshot:request", (raw: unknown, ack?: AckFn) => {
      if (typeof raw !== "string") {
        return ackError(ack, "invalid_payload", "Invalid room code.");
      }

      const result = store.getSnapshot(normalizeRoomCode(raw));
      if (!result.ok) {
        return ackStoreError(ack, result);
      }

      return ack?.({ ok: true, snapshot: result.value });
    });

    socket.on("disconnect", () => {
      emitEvents(namespace, store.disconnectSocket(socket.id));
    });
  });

  const cleanupTimer = setInterval(() => {
    emitEvents(namespace, store.cleanupExpiredRooms());
  }, 30_000);

  return {
    io,
    store,
    close: () => {
      clearInterval(cleanupTimer);
      io.close();
    },
  };
}

function emitEvents(namespace: ReturnType<Server["of"]>, events: RoomEvent[]) {
  for (const event of events) {
    if (event.type === "snapshot") {
      namespace.to(event.roomCode).emit("room:snapshot", event.snapshot);
    }

    if (event.type === "command") {
      namespace.to(event.roomCode).emit("control:apply", event.command);
    }

    if (event.type === "closed") {
      namespace.to(event.roomCode).emit("room:closed", { reason: event.reason });
    }
  }
}

function parseCorsOrigin(origin: string) {
  if (origin === "*") {
    return "*";
  }

  return origin.split(",").map((item) => item.trim());
}

function ackError(ack: AckFn | undefined, code: string, message: string) {
  ack?.({ ok: false, code, message });
}

function ackStoreError(ack: AckFn | undefined, error: StoreError) {
  ack?.({ ok: false, code: error.code, message: error.message });
}
