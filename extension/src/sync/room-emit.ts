import type { Ack } from "@watch-party-sync/protocol";
import type { Socket } from "socket.io-client";

// Low-level socket emit/ack helpers, kept out of the background worker so that file stays focused
// on room/tab orchestration. Each takes the live socket explicitly (it is reassigned on reconnect).

const ACK_TIMEOUT_MS = 12_000;
const CONNECT_TIMEOUT_MS = 15_000;

// Generic emit used by clock sync; resolves only when the server replies (no timeout).
export function emitWithAck<T>(
  socket: Socket | undefined,
  event: string,
  payload: unknown,
): Promise<T> {
  return new Promise((resolve) => {
    socket?.emit(event, payload, (ack: T) => resolve(ack));
  });
}

// Emit a room event and always settle: a missing socket or a lost ack resolves a failed Ack
// instead of hanging forever (which previously left the popup stuck on "connecting").
export function emitAck(socket: Socket | undefined, event: string, payload: unknown): Promise<Ack> {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve({ ok: false, code: "server_disconnected", message: "Not connected to server." });
      return;
    }

    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ ok: false, code: "timeout", message: "Server did not respond. Try again." });
    }, ACK_TIMEOUT_MS);

    socket.emit(event, payload, (ack: Ack) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(ack);
    });
  });
}

// Resolve once the socket connects, or false on timeout. A single transient connect_error is not
// fatal — reconnection is on, so we let it retry and only give up on the timeout. This covers the
// slower first TLS+WebSocket handshake (e.g. a cold Render Free instance).
export function waitForConnect(socket: Socket | undefined): Promise<boolean> {
  return new Promise((resolve) => {
    if (socket?.connected) {
      resolve(true);
      return;
    }

    const timeout = setTimeout(() => resolve(false), CONNECT_TIMEOUT_MS);
    socket?.once("connect", () => {
      clearTimeout(timeout);
      resolve(true);
    });
  });
}
