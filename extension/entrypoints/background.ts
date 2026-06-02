import {
  type Ack,
  type ControlRequest,
  type MediaKey,
  type PlaybackCommand,
  type PlayerState,
  type RoomMode,
  type RoomSnapshot,
  estimateClockOffset,
  normalizeRoomCode,
} from "@watch-party-sync/protocol";
import { type Socket, io } from "socket.io-client";
import { browser } from "wxt/browser";
import {
  type ExtensionState,
  type ProviderDetection,
  type RuntimeRequest,
  fail,
  ok,
} from "../src/shared/runtime-messages";
import { hasServerHostAccess, normalizeServerUrl } from "../src/shared/server-permissions";
import { loadSettings, saveSetting } from "../src/shared/storage";

let socket: Socket | undefined;
let clockTimer: number | undefined;
let state: ExtensionState = {
  serverUrl: "http://localhost:8787",
  memberId: "",
  displayName: "Friend",
  debug: false,
  connectionStatus: "disconnected",
  serverOffsetMs: 0,
};

export default defineBackground(() => {
  initializeState().catch((error) => {
    state.lastError = String(error);
  });

  browser.runtime.onMessage.addListener((message: RuntimeRequest, sender) => {
    return handleMessage(message, sender);
  });
});

async function initializeState() {
  const settings = await loadSettings();
  state = { ...state, ...settings };
}

async function handleMessage(message: RuntimeRequest, sender: { tab?: { id?: number } }) {
  if (message.type === "popup:get-state") {
    await refreshActiveTab();
    return ok(state);
  }

  if (message.type === "popup:set-profile") {
    state.displayName = message.displayName.trim() || "Friend";
    await saveSetting("displayName", state.displayName);
    return ok(state);
  }

  if (message.type === "popup:set-server-url") {
    state.serverUrl = normalizeServerUrl(message.serverUrl);
    await saveSetting("serverUrl", state.serverUrl);
    disconnectSocket();
    await broadcastStateToContent();
    return ok(state);
  }

  if (message.type === "popup:set-debug") {
    state.debug = message.debug;
    await saveSetting("debug", state.debug);
    await broadcastStateToContent();
    return ok(state);
  }

  if (message.type === "popup:refresh-active-tab") {
    await refreshActiveTab();
    return ok(state);
  }

  if (message.type === "popup:create-room") {
    return createRoom(message.mode);
  }

  if (message.type === "popup:join-room") {
    return joinRoom(message.roomCode);
  }

  if (message.type === "popup:leave-room") {
    state.room = undefined;
    await broadcastStateToContent();
    return ok(state);
  }

  if (message.type === "popup:set-ready") {
    return setReady(message.ready);
  }

  if (message.type === "popup:control") {
    return requestControl(message.command, message.position, message.playbackRate);
  }

  if (message.type === "content:provider-detected") {
    state.provider = message.detection;
    state.activeTabId = sender.tab?.id;
    await broadcastStateToContent();
    return ok(state);
  }

  if (message.type === "content:player-state") {
    state.player = { ...message.state, capturedAt: Date.now() + state.serverOffsetMs };
    await forwardPlayerState(state.player);
    return ok(state);
  }

  if (message.type === "content:media-change") {
    state.provider = {
      supported: true,
      providerId: message.mediaKey.providerId,
      mediaKey: message.mediaKey,
      title: message.mediaKey.title,
    };
    state.player = undefined;
    await broadcastStateToContent();
    return ok(state);
  }

  if (message.type === "content:error") {
    state.lastError = message.message;
    return ok(state);
  }

  return fail("Unsupported runtime message.");
}

async function createRoom(mode: RoomMode) {
  const detection = await requireDetection();
  if (!detection.supported) {
    return fail(detection.reason, "unsupported_provider");
  }

  const connected = await ensureSocket();
  if (!connected) {
    return fail("Could not connect to room server.", "server_disconnected");
  }

  const ack = await emitWithAck<Ack>("room:create", {
    memberId: state.memberId,
    displayName: state.displayName,
    mode,
    providerId: detection.providerId,
    mediaKey: detection.mediaKey,
  });

  if (!ack.ok || !ack.snapshot) {
    return fail(
      ack.ok ? "Room snapshot missing." : ack.message,
      ack.ok ? "snapshot_missing" : ack.code,
    );
  }

  state.room = ack.snapshot;
  await broadcastStateToContent();
  return ok(state);
}

async function joinRoom(roomCode: string) {
  const detection = await requireDetection();
  if (!detection.supported) {
    return fail(detection.reason, "unsupported_provider");
  }

  const connected = await ensureSocket();
  if (!connected) {
    return fail("Could not connect to room server.", "server_disconnected");
  }

  const ack = await emitWithAck<Ack>("room:join", {
    roomCode: normalizeRoomCode(roomCode),
    memberId: state.memberId,
    displayName: state.displayName,
    providerId: detection.providerId,
    mediaKey: detection.mediaKey,
  });

  if (!ack.ok || !ack.snapshot) {
    return fail(
      ack.ok ? "Room snapshot missing." : ack.message,
      ack.ok ? "snapshot_missing" : ack.code,
    );
  }

  state.room = ack.snapshot;
  await broadcastStateToContent();
  return ok(state);
}

async function setReady(ready: boolean) {
  if (!state.room) {
    return fail("Join a room first.", "room_required");
  }

  const playerState = await readActivePlayerState();
  const ack = await emitWithAck<Ack>("member:ready", {
    roomCode: state.room.code,
    memberId: state.memberId,
    ready,
    state: playerState,
  });

  if (!ack.ok || !ack.snapshot) {
    return fail(
      ack.ok ? "Room snapshot missing." : ack.message,
      ack.ok ? "snapshot_missing" : ack.code,
    );
  }

  state.room = ack.snapshot;
  state.player = playerState;
  await broadcastStateToContent();
  return ok(state);
}

async function requestControl(
  type: ControlRequest["type"],
  position?: number,
  playbackRate?: number,
) {
  if (!state.room) {
    return fail("Join a room first.", "room_required");
  }

  const playerState = await readActivePlayerState();
  const ack = await emitWithAck<Ack>("control:request", {
    roomCode: state.room.code,
    memberId: state.memberId,
    type,
    position: position ?? playerState.currentTime,
    playbackRate: playbackRate ?? playerState.playbackRate,
  });

  if (!ack.ok) {
    return fail(ack.message, ack.code);
  }

  state.player = playerState;
  return ok(state);
}

async function requireDetection(): Promise<ProviderDetection> {
  await refreshActiveTab();
  return state.provider ?? { supported: false, reason: "Open a supported video tab first." };
}

async function refreshActiveTab() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    state.activeTabId = undefined;
    state.provider = { supported: false, reason: "No active tab." };
    return;
  }

  state.activeTabId = tab.id;
  const response = await sendToTab<ProviderDetection>(tab.id, { type: "content:get-detection" });
  state.provider = response.ok ? response.value : { supported: false, reason: response.message };
}

async function readActivePlayerState(): Promise<PlayerState> {
  if (!state.activeTabId) {
    throw new Error("No active provider tab.");
  }

  const response = await sendToTab<PlayerState>(state.activeTabId, { type: "content:get-state" });
  if (!response.ok) {
    throw new Error(response.message);
  }

  return { ...response.value, capturedAt: Date.now() + state.serverOffsetMs };
}

async function ensureSocket(): Promise<boolean> {
  if (socket?.connected) {
    return true;
  }

  if (!(await hasServerHostAccess(state.serverUrl))) {
    state.connectionStatus = "disconnected";
    state.lastError = "Server access not granted. Open Options and save the server URL.";
    return false;
  }

  state.connectionStatus = socket ? "reconnecting" : "connecting";
  socket = io(`${state.serverUrl}/rooms`, {
    transports: ["websocket", "polling"],
    reconnection: true,
  });

  socket.on("connect", () => {
    state.connectionStatus = "connected";
    startClockSync();
    requestSnapshotAfterReconnect().catch(() => undefined);
  });

  socket.on("disconnect", () => {
    state.connectionStatus = "disconnected";
  });

  socket.on("room:snapshot", (snapshot: RoomSnapshot) => {
    state.room = snapshot;
    broadcastStateToContent().catch(() => undefined);
  });

  socket.on("control:apply", (command: PlaybackCommand) => {
    state.room = state.room ? { ...state.room, lastCommand: command } : state.room;
    sendCommandToContent(command).catch(() => undefined);
  });

  socket.on("room:error", (error: { message?: string }) => {
    state.lastError = error.message ?? "Room error.";
  });

  socket.on("room:closed", (payload: { reason?: string }) => {
    state.lastError = `Room closed: ${payload.reason ?? "unknown"}`;
    state.room = undefined;
    broadcastStateToContent().catch(() => undefined);
  });

  return waitForConnect();
}

function disconnectSocket() {
  stopClockSync();
  socket?.disconnect();
  socket = undefined;
  state.connectionStatus = "disconnected";
}

function emitWithAck<T>(event: string, payload: unknown): Promise<T> {
  return new Promise((resolve) => {
    socket?.emit(event, payload, (ack: T) => resolve(ack));
  });
}

function waitForConnect(): Promise<boolean> {
  return new Promise((resolve) => {
    if (socket?.connected) {
      resolve(true);
      return;
    }

    const timeout = setTimeout(() => resolve(false), 5000);
    socket?.once("connect", () => {
      clearTimeout(timeout);
      resolve(true);
    });
    socket?.once("connect_error", () => {
      clearTimeout(timeout);
      resolve(false);
    });
  });
}

function startClockSync() {
  stopClockSync();
  syncClock().catch(() => undefined);
  clockTimer = self.setInterval(() => {
    syncClock().catch(() => undefined);
  }, 20_000);
}

function stopClockSync() {
  if (clockTimer !== undefined) {
    clearInterval(clockTimer);
    clockTimer = undefined;
  }
}

async function syncClock() {
  const clientSentAt = Date.now();
  const pong = await emitWithAck<{ clientSentAt: number; serverAt: number }>(
    "clock:ping",
    clientSentAt,
  );
  const clientReceiveAt = Date.now();
  const sample = estimateClockOffset(pong.clientSentAt, pong.serverAt, clientReceiveAt);
  state.serverOffsetMs = sample.offset;
}

async function requestSnapshotAfterReconnect() {
  if (!state.room) {
    return;
  }

  const ack = await emitWithAck<Ack>("room:snapshot:request", state.room.code);
  if (ack.ok && ack.snapshot) {
    state.room = ack.snapshot;
    await broadcastStateToContent();
  }
}

async function forwardPlayerState(playerState: PlayerState) {
  if (!state.room || !socket?.connected) {
    return;
  }

  socket.emit("player:state", {
    roomCode: state.room.code,
    memberId: state.memberId,
    state: playerState,
  });
}

async function sendCommandToContent(command: PlaybackCommand) {
  if (!state.activeTabId) {
    return;
  }

  await sendToTab(state.activeTabId, {
    type: "content:apply-command",
    command,
    serverOffsetMs: state.serverOffsetMs,
  });
  await broadcastStateToContent();
}

async function broadcastStateToContent() {
  if (!state.activeTabId) {
    return;
  }

  await sendToTab(state.activeTabId, {
    type: "content:set-room-state",
    state,
  }).catch(() => undefined);
}

async function sendToTab<T>(tabId: number, message: RuntimeRequest) {
  return browser.tabs.sendMessage(tabId, message) as Promise<
    | { ok: true; value: T }
    | {
        ok: false;
        message: string;
        code?: string;
      }
  >;
}
