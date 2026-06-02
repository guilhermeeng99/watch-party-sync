import type { ExtensionState } from "../shared/runtime-messages";

let root: ShadowRoot | undefined;

export function renderOverlay(state: ExtensionState) {
  if (!state.room) {
    clearOverlay();
    return;
  }

  const shadow = ensureRoot();
  const readyCount = state.room.members.filter((member) => member.ready).length;
  const connectedCount = state.room.members.filter((member) => member.connected).length;
  const providerLabel = state.provider?.supported ? state.provider.providerId : "unsupported";

  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      .wps-overlay {
        position: fixed;
        z-index: 2147483647;
        top: 16px;
        right: 16px;
        min-width: 172px;
        max-width: 240px;
        box-sizing: border-box;
        padding: 10px 12px;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.96);
        color: #0B3558;
        box-shadow: 0 10px 28px rgba(11, 53, 88, 0.22);
        font-family: "Montserrat", ui-sans-serif, system-ui, sans-serif;
        font-size: 12px;
        line-height: 1.4;
        pointer-events: none;
      }
      .row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
      .title { font-weight: 700; font-size: 13px; }
      .badge {
        border-radius: 999px;
        padding: 2px 7px;
        background: #E7EDF6;
        color: #004EBA;
        font-weight: 600;
      }
      .muted { color: #476788; margin-top: 4px; }
      .debug { color: #A15C00; margin-top: 6px; font-variant-numeric: tabular-nums; }
    </style>
    <div class="wps-overlay">
      <div class="row">
        <span class="title">Watch Party</span>
        <span class="badge">${escapeHtml(state.room.code)}</span>
      </div>
      <div class="muted">${readyCount}/${connectedCount} ready - ${escapeHtml(providerLabel)}</div>
      ${state.debug ? `<div class="debug">offset ${Math.round(state.serverOffsetMs)}ms</div>` : ""}
    </div>
  `;
}

export function clearOverlay() {
  document.getElementById("watch-party-sync-overlay")?.remove();
  root = undefined;
}

function ensureRoot() {
  if (root) {
    return root;
  }

  const host = document.createElement("div");
  host.id = "watch-party-sync-overlay";
  document.documentElement.append(host);
  root = host.attachShadow({ mode: "open" });
  return root;
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
