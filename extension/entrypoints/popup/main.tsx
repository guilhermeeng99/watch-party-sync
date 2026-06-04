import {
  Check,
  Copy,
  ExternalLink,
  LogOut,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Settings,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { browser } from "wxt/browser";
import "../../src/styles.css";
import { sendToRuntime as send } from "../../src/shared/messaging";
import type { ExtensionState, RuntimeRequest } from "../../src/shared/runtime-messages";

type ActionState = "idle" | "busy";

function PopupApp() {
  const [state, setState] = useState<ExtensionState>();
  const [roomCode, setRoomCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [actionState, setActionState] = useState<ActionState>("idle");
  const [error, setError] = useState<string>();

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 1500);
    return () => window.clearInterval(timer);
  }, []);

  // Seed the name field once from saved settings without clobbering active typing.
  useEffect(() => {
    if (state?.displayName && !displayName) {
      setDisplayName(state.displayName);
    }
  }, [displayName, state?.displayName]);

  const nameReady = displayName.trim().length > 0;
  const supported = state?.provider?.supported ?? false;
  const inRoom = Boolean(state?.room);

  async function refresh() {
    const response = await send<ExtensionState>({ type: "popup:get-state" });
    if (response.ok) {
      setState(response.value);
    }
  }

  async function run<T>(request: RuntimeRequest) {
    setActionState("busy");
    setError(undefined);
    const response = await send<T>(request);
    setActionState("idle");

    if (response.ok) {
      await refresh();
      return;
    }

    setError(response.message);
  }

  // Persist the name before any room action so create/join always use the latest value.
  async function commitNameThen(request: RuntimeRequest) {
    if (!nameReady) {
      setError("Enter your name first.");
      return;
    }
    await send<ExtensionState>({ type: "popup:set-profile", displayName: displayName.trim() });
    await run(request);
  }

  return (
    <main className="popup-shell">
      <header className="popup-header">
        <div className="truncate">
          <h1 className="title">Watch Party</h1>
          <div className="caption truncate">Watch in sync with friends</div>
        </div>
        <ConnectionBadge status={state?.connectionStatus ?? "disconnected"} />
      </header>

      {inRoom && state ? (
        <RoomView
          state={state}
          busy={actionState === "busy"}
          onPlay={() => run<ExtensionState>({ type: "popup:control", command: "play" })}
          onPause={() => run<ExtensionState>({ type: "popup:control", command: "pause" })}
          onReady={(ready) => run<ExtensionState>({ type: "popup:set-ready", ready })}
          onOpenVideo={() => run<ExtensionState>({ type: "popup:open-room-media" })}
          onLeave={() => run<ExtensionState>({ type: "popup:leave-room" })}
        />
      ) : (
        <SetupView
          state={state}
          displayName={displayName}
          roomCode={roomCode}
          nameReady={nameReady}
          supported={supported}
          busy={actionState === "busy"}
          onName={setDisplayName}
          onSaveName={() =>
            nameReady &&
            send<ExtensionState>({ type: "popup:set-profile", displayName: displayName.trim() })
          }
          onRoomCode={setRoomCode}
          onRefresh={() => run<ExtensionState>({ type: "popup:refresh-active-tab" })}
          onCreate={() => commitNameThen({ type: "popup:create-room", mode: "friend" })}
          onJoin={() => commitNameThen({ type: "popup:join-room", roomCode })}
        />
      )}

      {error || state?.lastError ? (
        <div className="panel-flat error">{error ?? state?.lastError}</div>
      ) : null}

      <footer className="popup-footer">
        <button
          className="button button-secondary button-small"
          type="button"
          onClick={() => browser.runtime.openOptionsPage()}
        >
          <Settings size={16} />
          Options
        </button>
        <span className="caption truncate">Server: {state?.serverUrl ?? "..."}</span>
      </footer>
    </main>
  );
}

function SetupView({
  state,
  displayName,
  roomCode,
  nameReady,
  supported,
  busy,
  onName,
  onSaveName,
  onRoomCode,
  onRefresh,
  onCreate,
  onJoin,
}: {
  state?: ExtensionState;
  displayName: string;
  roomCode: string;
  nameReady: boolean;
  supported: boolean;
  busy: boolean;
  onName: (value: string) => void;
  onSaveName: () => void;
  onRoomCode: (value: string) => void;
  onRefresh: () => void;
  onCreate: () => void;
  onJoin: () => void;
}) {
  return (
    <>
      <section className="panel stack">
        <label className="field">
          <span className="field-label">1. Your name</span>
          <input
            className="input"
            value={displayName}
            maxLength={40}
            placeholder="e.g. Alex"
            onChange={(event) => onName(event.target.value)}
            onBlur={onSaveName}
          />
          <span className="caption">Friends see this name in the room.</span>
        </label>
      </section>

      <section className="panel stack">
        <div className="row-between">
          <h2 className="section-title">2. Start watching together</h2>
          <button
            className="button button-secondary button-icon"
            type="button"
            title="Re-check this tab"
            onClick={onRefresh}
          >
            <RefreshCw size={16} />
          </button>
        </div>

        <ProviderSummary state={state} />

        <button
          className="button button-primary button-full"
          type="button"
          disabled={!supported || !nameReady || busy}
          onClick={onCreate}
        >
          <Plus size={16} />
          Create a room on this video
        </button>
        {!supported ? (
          <span className="caption">Open a YouTube or Crunchyroll video to host a room.</span>
        ) : null}

        <div className="or-divider">
          <span>or join with a code</span>
        </div>

        <div className="join-row">
          <input
            className="input mono"
            value={roomCode}
            placeholder="ROOM CODE"
            maxLength={16}
            onChange={(event) => onRoomCode(event.target.value.toUpperCase())}
          />
          <button
            className="button button-secondary"
            type="button"
            disabled={!nameReady || !roomCode.trim() || busy}
            onClick={onJoin}
          >
            Join
          </button>
        </div>
        <span className="caption">Joining opens the host's video for you automatically.</span>
      </section>
    </>
  );
}

function RoomView({
  state,
  busy,
  onPlay,
  onPause,
  onReady,
  onOpenVideo,
  onLeave,
}: {
  state: ExtensionState;
  busy: boolean;
  onPlay: () => void;
  onPause: () => void;
  onReady: (ready: boolean) => void;
  onOpenVideo: () => void;
  onLeave: () => void;
}) {
  const room = state.room;
  if (!room) return null;

  const selfMember = room.members.find((member) => member.memberId === state.memberId);
  const ready = Boolean(selfMember?.ready);
  const providerTitle = state.provider?.supported ? state.provider.title : undefined;
  const title = room.mediaKey?.title ?? providerTitle;
  // Member is not currently on a supported video tab — offer to open the room's video.
  const offVideo = !state.provider?.supported && Boolean(room.mediaKey?.url);

  return (
    <>
      <section className="panel stack">
        <div className="row-between">
          <h2 className="section-title">Room code</h2>
          <span className="caption">{room.mode} mode</span>
        </div>
        <RoomCode code={room.code} />
        <span className="caption">Share this code so friends can join.</span>
        {title ? <div className="provider-title truncate">Now watching: {title}</div> : null}
        {offVideo ? (
          <button
            className="button button-primary button-full"
            type="button"
            disabled={busy}
            onClick={onOpenVideo}
          >
            <ExternalLink size={16} />
            Open the video
          </button>
        ) : null}
      </section>

      <section className="panel stack">
        <h2 className="section-title">Playback</h2>
        <div className="button-grid compact-controls">
          <button
            className="button button-secondary"
            type="button"
            disabled={busy}
            onClick={onPlay}
          >
            <Play size={16} />
            Play
          </button>
          <button
            className="button button-secondary"
            type="button"
            disabled={busy}
            onClick={onPause}
          >
            <Pause size={16} />
            Pause
          </button>
        </div>
        <span className="caption">
          Play, pause and seek on the video itself — everyone follows along.
        </span>
        <div className="button-grid compact-controls">
          <button
            className="button button-primary"
            type="button"
            disabled={busy}
            onClick={() => onReady(!ready)}
          >
            {ready ? "Not ready" : "I'm ready"}
          </button>
          <button className="button button-danger" type="button" disabled={busy} onClick={onLeave}>
            <LogOut size={16} />
            Leave
          </button>
        </div>
      </section>

      <MemberList state={state} />
    </>
  );
}

function RoomCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="code-row">
      <span className="code-display mono">{code}</span>
      <button className="button button-secondary" type="button" onClick={copy} title="Copy code">
        {copied ? <Check size={16} /> : <Copy size={16} />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function ProviderSummary({ state }: { state?: ExtensionState }) {
  if (!state?.provider) {
    return <div className="muted">Checking the current tab…</div>;
  }

  if (!state.provider.supported) {
    return (
      <div className="row-between">
        <span className="truncate muted">{state.provider.reason}</span>
        <span className="badge badge-warning">No video</span>
      </div>
    );
  }

  return (
    <div className="row-between">
      <span className="provider-title truncate">
        {state.provider.mediaKey.title ?? state.provider.mediaKey.id}
      </span>
      <span className="badge badge-success">Ready</span>
    </div>
  );
}

function MemberList({ state }: { state: ExtensionState }) {
  if (!state.room) return null;

  return (
    <section className="panel">
      <div className="row-between">
        <h2 className="section-title">Friends</h2>
        <span className="badge badge-info">
          {state.room.members.filter((member) => member.connected).length}/
          {state.room.members.length}
        </span>
      </div>
      {state.room.members.map((member) => (
        <div className="member-row" key={member.memberId}>
          <div className="truncate">
            <strong>{member.displayName}</strong>
            <div className="caption">
              {member.role}
              {member.memberId === state.memberId ? " · you" : ""}
            </div>
          </div>
          <span
            className={`badge ${member.connected ? (member.ready ? "badge-success" : "badge-info") : "badge-danger"}`}
          >
            {member.connected ? (member.ready ? "Ready" : "Waiting") : "Offline"}
          </span>
        </div>
      ))}
    </section>
  );
}

function ConnectionBadge({ status }: { status: string }) {
  const className =
    status === "connected"
      ? "badge-success"
      : status === "connecting" || status === "reconnecting"
        ? "badge-warning"
        : "badge-danger";
  return <span className={`badge ${className}`}>{status}</span>;
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Popup root element not found.");
}

createRoot(rootElement).render(
  <React.StrictMode>
    <PopupApp />
  </React.StrictMode>,
);
