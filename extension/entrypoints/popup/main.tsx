import { Pause, Play, RefreshCw, Settings, Users } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { browser } from "wxt/browser";
import "../../src/styles.css";
import type {
  ExtensionState,
  RuntimeRequest,
  RuntimeResponse,
} from "../../src/shared/runtime-messages";

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

  useEffect(() => {
    if (state?.displayName && !displayName) {
      setDisplayName(state.displayName);
    }
  }, [displayName, state?.displayName]);

  const selfMember = useMemo(
    () => state?.room?.members.find((member) => member.memberId === state.memberId),
    [state],
  );
  const ready = Boolean(selfMember?.ready);
  const supported = state?.provider?.supported;

  async function refresh() {
    const response = await send<ExtensionState>({ type: "popup:get-state" });
    if (response.ok) {
      setState(response.value);
    }
  }

  async function run<T>(request: RuntimeRequest, after?: (value: T) => void) {
    setActionState("busy");
    setError(undefined);
    const response = await send<T>(request);
    setActionState("idle");

    if (response.ok) {
      after?.(response.value);
      await refresh();
      return;
    }

    setError(response.message);
  }

  async function saveName() {
    if (!displayName.trim()) return;
    await run<ExtensionState>({ type: "popup:set-profile", displayName });
  }

  return (
    <main className="popup-shell">
      <header className="popup-header">
        <div className="truncate">
          <h1 className="title">Watch Party</h1>
          <div className="caption truncate">Sync official players</div>
        </div>
        <ConnectionBadge status={state?.connectionStatus ?? "disconnected"} />
      </header>

      <section className="panel stack">
        <div className="row-between">
          <h2 className="section-title">Current tab</h2>
          <button
            className="button button-secondary button-icon"
            type="button"
            title="Refresh current tab"
            onClick={() => run<ExtensionState>({ type: "popup:refresh-active-tab" })}
          >
            <RefreshCw size={16} />
          </button>
        </div>
        <ProviderSummary state={state} />
      </section>

      <section className="panel stack">
        <div className="row-between">
          <h2 className="section-title">Room</h2>
          {state?.room ? <span className="badge badge-info mono">{state.room.code}</span> : null}
        </div>

        <div className="field-grid">
          <label className="field">
            <span className="field-label">Name</span>
            <input
              className="input"
              value={displayName}
              maxLength={40}
              placeholder="Display name"
              onChange={(event) => setDisplayName(event.target.value)}
              onBlur={saveName}
            />
          </label>
        </div>

        {state?.room ? (
          <RoomControls
            busy={actionState === "busy"}
            ready={ready}
            onReady={() => run<ExtensionState>({ type: "popup:set-ready", ready: !ready })}
            onLeave={() => run<ExtensionState>({ type: "popup:leave-room" })}
          />
        ) : (
          <div className="stack compact-stack">
            <button
              className="button button-primary button-full"
              type="button"
              disabled={!supported || actionState === "busy"}
              onClick={() => run<ExtensionState>({ type: "popup:create-room", mode: "friend" })}
            >
              <Users size={16} />
              Create room
            </button>
            <div className="join-row">
              <input
                className="input mono"
                value={roomCode}
                placeholder="ROOM CODE"
                onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
              />
              <button
                className="button button-secondary"
                type="button"
                disabled={!supported || !roomCode.trim() || actionState === "busy"}
                onClick={() => run<ExtensionState>({ type: "popup:join-room", roomCode })}
              >
                Join
              </button>
            </div>
          </div>
        )}
      </section>

      {state?.room ? (
        <section className="panel stack">
          <div className="row-between">
            <h2 className="section-title">Controls</h2>
            <span className="caption">{state.room.mode} mode</span>
          </div>
          <div className="button-grid compact-controls">
            <button
              className="button button-secondary"
              type="button"
              disabled={actionState === "busy"}
              onClick={() => run<ExtensionState>({ type: "popup:control", command: "play" })}
            >
              <Play size={16} />
              Play
            </button>
            <button
              className="button button-secondary"
              type="button"
              disabled={actionState === "busy"}
              onClick={() => run<ExtensionState>({ type: "popup:control", command: "pause" })}
            >
              <Pause size={16} />
              Pause
            </button>
          </div>
        </section>
      ) : null}

      {state?.room ? <MemberList state={state} /> : null}

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

function ProviderSummary({ state }: { state?: ExtensionState }) {
  if (!state?.provider) {
    return <div className="muted">Open a supported video tab.</div>;
  }

  if (!state.provider.supported) {
    return (
      <div className="row-between">
        <span className="truncate muted">{state.provider.reason}</span>
        <span className="badge badge-warning">Unsupported</span>
      </div>
    );
  }

  return (
    <div className="stack compact-stack">
      <div className="row-between">
        <span className="provider-title truncate">
          {state.provider.mediaKey.title ?? state.provider.mediaKey.id}
        </span>
        <span className="badge badge-success">Ready</span>
      </div>
      <div className="caption truncate">{state.provider.providerId}</div>
    </div>
  );
}

function RoomControls({
  busy,
  ready,
  onReady,
  onLeave,
}: {
  busy: boolean;
  ready: boolean;
  onReady: () => void;
  onLeave: () => void;
}) {
  return (
    <div className="button-grid compact-controls">
      <button className="button button-primary" type="button" disabled={busy} onClick={onReady}>
        {ready ? "Unready" : "Ready"}
      </button>
      <button className="button button-danger" type="button" disabled={busy} onClick={onLeave}>
        Leave
      </button>
    </div>
  );
}

function MemberList({ state }: { state: ExtensionState }) {
  if (!state.room) return null;

  return (
    <section className="panel">
      <div className="row-between">
        <h2 className="section-title">Members</h2>
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
              {member.memberId === state.memberId ? " - you" : ""}
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
      : status === "connecting"
        ? "badge-warning"
        : "badge-danger";
  return <span className={`badge ${className}`}>{status}</span>;
}

async function send<T>(message: RuntimeRequest): Promise<RuntimeResponse<T>> {
  return browser.runtime.sendMessage(message);
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
