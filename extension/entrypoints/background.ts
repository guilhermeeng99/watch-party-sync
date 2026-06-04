import {
  type Ack,
  type ControlRequest,
  type MediaKey,
  type PlaybackCommand,
  type PlayerState,
  type RoomMode,
  type RoomSnapshot,
  estimateClockOffset,
  mediaKeysEqual,
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
import {
  DEFAULT_SERVER_URL,
  hasServerHostAccess,
  normalizeServerUrl,
} from "../src/shared/server-permissions";
import { loadSettings, saveSetting } from "../src/shared/storage";

// Keep the MV3 service worker awake while a room is active. Chrome can suspend an idle
// worker after ~30s, which would silently kill the socket and drop the member from the room.
const KEEPALIVE_ALARM = "wps-keepalive";
const KEEPALIVE_PERIOD_MINUTES = 0.4; // ~24s, under Chrome's idle suspend window.

let socket: Socket | undefined;
let clockTimer: number | undefined;
// Room the worker should stay connected to, persisted so it survives a worker restart.
let activeRoomCode = "";
let state: ExtensionState = {
  serverUrl: DEFAULT_SERVER_URL,
  memberId: "",
  displayName: "Friend",
  debug: false,
  connectionStatus: "disconnected",
  serverOffsetMs: 0,
};

export default defineBackground(() => {
  // Listeners must be registered synchronously so an alarm can wake the worker.
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === KEEPALIVE_ALARM) {
      keepaliveTick().catch(() => undefined);
    }
  });

  browser.runtime.onMessage.addListener((message: RuntimeRequest, sender) => {
    return handleMessage(message, sender);
  });

  initializeState().catch((error) => {
    state.lastError = String(error);
  });
});

async function initializeState() {
  const settings = await loadSettings();
  state = { ...state, ...settings };
  activeRoomCode = settings.activeRoomCode;

  // Worker (re)started while a room was active: reconnect and rejoin to recover the snapshot.
  if (activeRoomCode) {
    startKeepalive();
    await rejoinRoom(activeRoomCode).catch(() => undefined);
  }
}

async function handleMessage(message: RuntimeRequest, sender: { tab?: { id?: number } }) {
  if (message.type === "popup:get-state") {
    await recoverRoomIfNeeded();
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
    await exitRoom();
    return ok(state);
  }

  if (message.type === "popup:open-room-media") {
    await openRoomMedia();
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
    await catchUpToRoom();
    return ok(state);
  }

  if (message.type === "content:player-state") {
    state.activeTabId = sender.tab?.id ?? state.activeTabId;
    state.player = { ...message.state, capturedAt: Date.now() + state.serverOffsetMs };
    await forwardPlayerState(state.player);
    return ok(state);
  }

  if (message.type === "content:user-intent") {
    state.activeTabId = sender.tab?.id ?? state.activeTabId;
    return requestControl(message.command, message.position, message.playbackRate);
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

  const ack = await emitAck("room:create", {
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

  await enterRoom(ack.snapshot);
  return ok(state);
}

async function joinRoom(roomCode: string) {
  const connected = await ensureSocket();
  if (!connected) {
    return fail("Could not connect to room server.", "server_disconnected");
  }

  // Joining does not require already being on the room's video; we redirect after joining.
  // We deliberately omit our own mediaKey so the server never rejects us for a media mismatch.
  const ack = await emitAck("room:join", {
    roomCode: normalizeRoomCode(roomCode),
    memberId: state.memberId,
    displayName: state.displayName,
  });

  if (!ack.ok || !ack.snapshot) {
    return fail(
      ack.ok ? "Room snapshot missing." : ack.message,
      ack.ok ? "snapshot_missing" : ack.code,
    );
  }

  await enterRoom(ack.snapshot);
  await redirectToRoomMedia(ack.snapshot).catch(() => undefined);
  return ok(state);
}

// Common bookkeeping once a snapshot puts us in a room: cache it, persist for restart
// recovery, keep the worker alive, and push the new state to the page overlay.
async function enterRoom(snapshot: RoomSnapshot) {
  state.room = snapshot;
  activeRoomCode = snapshot.code;
  await saveSetting("activeRoomCode", snapshot.code);
  startKeepalive();
  await broadcastStateToContent();
}

// Navigate the active tab to the room's video so every member lands on the same page.
// Skips navigation when the user is already watching the room's media.
async function redirectToRoomMedia(snapshot: RoomSnapshot) {
  const url = snapshot.mediaKey?.url;
  if (!url) {
    return;
  }

  await refreshActiveTab();
  const alreadyWatching =
    state.provider?.supported && mediaKeysEqual(state.provider.mediaKey, snapshot.mediaKey);
  if (alreadyWatching) {
    return;
  }

  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id !== undefined) {
    await browser.tabs.update(tab.id, { url });
    state.activeTabId = tab.id;
    return;
  }

  const created = await browser.tabs.create({ url });
  state.activeTabId = created.id;
}

async function setReady(ready: boolean) {
  if (!state.room) {
    return fail("Join a room first.", "room_required");
  }

  // Player state is optional: a member may toggle ready while their tab has no controllable
  // player yet (e.g. before the video has loaded), so don't fail the whole action on that.
  const playerState = await readActivePlayerState().catch(() => undefined);
  const ack = await emitAck("member:ready", {
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
  if (playerState) {
    state.player = playerState;
  }
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

  let resolvedPosition = position;
  let resolvedRate = playbackRate;
  // Native intents already carry position/rate; only read the player when something is missing.
  if (resolvedPosition === undefined || resolvedRate === undefined) {
    const playerState = await readActivePlayerState().catch(() => undefined);
    if (playerState) {
      state.player = playerState;
      resolvedPosition ??= playerState.currentTime;
      resolvedRate ??= playerState.playbackRate;
    }
  }

  const ack = await emitAck("control:request", {
    roomCode: state.room.code,
    memberId: state.memberId,
    type,
    position: resolvedPosition,
    playbackRate: resolvedRate,
  });

  if (!ack.ok) {
    // The room mode rejected this control (e.g. a member seeking in friend mode). Snap the
    // local player back to the room's authoritative position so it doesn't drift away.
    if (ack.code === "forbidden") {
      await catchUpToRoom();
    }
    return fail(ack.message, ack.code);
  }

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
  // tabs.sendMessage rejects on pages with no content script (e.g. a Google tab). Treat that as
  // "no supported video here" instead of letting the rejection break the whole get-state flow,
  // which would freeze the popup on whatever it last showed.
  const response = await sendToTab<ProviderDetection>(tab.id, {
    type: "content:get-detection",
  }).catch(() => ({ ok: false as const, message: "No supported video on this tab." }));
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

  // A socket already exists and is auto-reconnecting. Do not create a second one (recovery can be
  // called every ~1.5s while the popup is open); just wait for the existing one to come up.
  if (socket) {
    state.connectionStatus = "reconnecting";
    return waitForConnect();
  }

  if (!(await hasServerHostAccess(state.serverUrl))) {
    state.connectionStatus = "disconnected";
    state.lastError = "Server access not granted. Open Options and save the server URL.";
    return false;
  }

  state.connectionStatus = "connecting";
  // WebSocket only: the MV3 service worker has no XMLHttpRequest, so socket.io's HTTP polling
  // transport throws and gets stuck in "connecting". WebSocket is available in the worker.
  socket = io(`${state.serverUrl}/rooms`, {
    transports: ["websocket"],
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

  socket.on("connect_error", (error: { message?: string }) => {
    // Surface the real reason instead of a generic "could not connect".
    state.lastError = `Connection error: ${error.message ?? "unknown"}`;
  });

  socket.on("room:error", (error: { message?: string }) => {
    state.lastError = error.message ?? "Room error.";
  });

  socket.on("room:closed", (payload: { reason?: string }) => {
    state.lastError = `Room closed: ${payload.reason ?? "unknown"}`;
    exitRoom().catch(() => undefined);
  });

  return waitForConnect();
}

function disconnectSocket() {
  stopClockSync();
  socket?.disconnect();
  socket = undefined;
  state.connectionStatus = "disconnected";
}

// Generic emit used by clock sync; resolves only when the server replies.
function emitWithAck<T>(event: string, payload: unknown): Promise<T> {
  return new Promise((resolve) => {
    socket?.emit(event, payload, (ack: T) => resolve(ack));
  });
}

// Emit a room event and always settle: a missing socket or a lost ack resolves a failed Ack
// instead of hanging forever (which previously left the popup stuck on "connecting").
function emitAck(event: string, payload: unknown): Promise<Ack> {
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
    }, 12_000);

    socket.emit(event, payload, (ack: Ack) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(ack);
    });
  });
}

function waitForConnect(): Promise<boolean> {
  return new Promise((resolve) => {
    if (socket?.connected) {
      resolve(true);
      return;
    }

    // Wait up to 15s for the first connect. A single transient connect_error is not treated as
    // fatal — reconnection is on, so we let it retry and only give up on the timeout. This covers
    // the slower first TLS+WebSocket handshake (e.g. a cold Render Free instance).
    const timeout = setTimeout(() => resolve(false), 15_000);
    socket?.once("connect", () => {
      clearTimeout(timeout);
      resolve(true);
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
  // After a transient reconnect with room state still cached, refresh from the snapshot.
  if (state.room) {
    const ack = await emitAck("room:snapshot:request", state.room.code);
    if (ack.ok && ack.snapshot) {
      state.room = ack.snapshot;
      await broadcastStateToContent();
    }
    return;
  }

  // Reconnected without cached room state (worker was restarted): rejoin from storage.
  if (activeRoomCode) {
    await rejoinRoom(activeRoomCode);
  }
}

// Re-enter a persisted room after a worker restart or socket drop. Sends no mediaKey so the
// server treats this as a reconnect and returns the current snapshot.
async function rejoinRoom(roomCode: string) {
  const connected = await ensureSocket();
  if (!connected) {
    return;
  }

  const ack = await emitAck("room:join", {
    roomCode: normalizeRoomCode(roomCode),
    memberId: state.memberId,
    displayName: state.displayName,
  });

  if (ack.ok && ack.snapshot) {
    await enterRoom(ack.snapshot);
    return;
  }

  // Room is gone (expired or server reset): drop the stale persisted code.
  if (!ack.ok && ack.code === "room_not_found") {
    await exitRoom();
  }
}

// When a tab finishes detecting the room's media (e.g. a fresh page load after the join
// redirect), replay the last command so the member snaps to the room's current playback.
// applyPlaybackCommand recomputes the live target position from elapsed server time, so a
// playing room stays aligned; the echo guard keeps this from rebroadcasting.
async function catchUpToRoom() {
  const command = state.room?.lastCommand;
  if (!command || !state.provider?.supported) {
    return;
  }

  if (!mediaKeysEqual(state.provider.mediaKey, command.mediaKey)) {
    return;
  }

  await sendCommandToContent(command);
}

async function exitRoom() {
  // Disconnect first: the server still lists us as a member and keeps broadcasting room
  // snapshots, which would otherwise immediately repopulate state.room and make Leave look
  // like it did nothing. Dropping the socket also makes the server mark us disconnected.
  disconnectSocket();
  state.room = undefined;
  activeRoomCode = "";
  await saveSetting("activeRoomCode", "");
  stopKeepalive();
  await broadcastStateToContent();
}

// Navigate the active tab to the room's video on demand (popup "Open video" button), for members
// who joined on another page or whose join redirect did not land them on the video.
async function openRoomMedia() {
  const url = state.room?.mediaKey?.url;
  if (!url) {
    return;
  }

  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id !== undefined) {
    await browser.tabs.update(tab.id, { url }).catch(() => undefined);
    state.activeTabId = tab.id;
  }
}

function startKeepalive() {
  browser.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: KEEPALIVE_PERIOD_MINUTES });
}

function stopKeepalive() {
  browser.alarms.clear(KEEPALIVE_ALARM).catch(() => undefined);
}

// Fires on the keepalive alarm. Reconnecting here is what recovers a member whose worker was
// suspended: waking for the alarm lets us re-establish the socket and rejoin the room.
async function keepaliveTick() {
  await recoverRoomIfNeeded();
}

// Self-heal: if we should be in a room but the socket dropped or the in-memory snapshot was lost
// (e.g. the MV3 worker restarted), reconnect and rejoin. Called on popup open and each keepalive.
async function recoverRoomIfNeeded() {
  if (!activeRoomCode) {
    stopKeepalive();
    return;
  }

  if (!socket?.connected || !state.room) {
    await rejoinRoom(activeRoomCode).catch(() => undefined);
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
  const tabId = await ensureRoomTabId();
  if (tabId === undefined) {
    return;
  }

  await sendToTab(tabId, {
    type: "content:apply-command",
    command,
    serverOffsetMs: state.serverOffsetMs,
  }).catch(() => undefined);
  await broadcastStateToContent();
}

// Resolve which tab should receive room commands. After a worker restart activeTabId is lost,
// so fall back to querying open tabs for the room's media URL.
async function ensureRoomTabId(): Promise<number | undefined> {
  if (state.activeTabId !== undefined) {
    return state.activeTabId;
  }

  const url = state.room?.mediaKey?.url;
  if (!url) {
    return undefined;
  }

  const [tab] = await browser.tabs.query({ url });
  if (tab?.id !== undefined) {
    state.activeTabId = tab.id;
  }
  return state.activeTabId;
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
