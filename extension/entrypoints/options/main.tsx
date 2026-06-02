import { CheckCircle2, Server, Shield } from "lucide-react";
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { browser } from "wxt/browser";
import "../../src/styles.css";
import type {
  ExtensionState,
  RuntimeRequest,
  RuntimeResponse,
} from "../../src/shared/runtime-messages";
import {
  normalizeServerUrl,
  requestServerHostAccess,
  serverUrlToOriginPattern,
} from "../../src/shared/server-permissions";

function OptionsApp() {
  const [state, setState] = useState<ExtensionState>();
  const [serverUrl, setServerUrl] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    send<ExtensionState>({ type: "popup:get-state" }).then((response) => {
      if (response.ok) {
        setState(response.value);
        setServerUrl(response.value.serverUrl);
      }
    });
  }, []);

  async function saveServerUrl() {
    const normalizedUrl = normalizeServerUrl(serverUrl);
    const origin = serverUrlToOriginPattern(normalizedUrl);
    if (!origin) {
      setError("Use a valid http:// or https:// server URL.");
      return;
    }

    const granted = await requestServerHostAccess(normalizedUrl);
    if (!granted) {
      setError(`Chrome access was not granted for ${origin}.`);
      return;
    }

    const response = await send<ExtensionState>({
      type: "popup:set-server-url",
      serverUrl: normalizedUrl,
    });
    if (response.ok) {
      setError("");
      setState(response.value);
      setServerUrl(response.value.serverUrl);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1600);
    } else {
      setError(response.message);
    }
  }

  async function setDebug(debug: boolean) {
    const response = await send<ExtensionState>({ type: "popup:set-debug", debug });
    if (response.ok) {
      setState(response.value);
    }
  }

  return (
    <main className="options-shell">
      <div className="options-page stack-lg">
        <header className="panel stack">
          <h1 className="title">Watch Party Sync</h1>
          <p className="muted">Configure the self-hosted room server and local debugging tools.</p>
        </header>

        <section className="panel stack">
          <div className="row">
            <Server size={18} />
            <h2 className="section-title">Room server</h2>
          </div>
          <div className="row">
            <input
              className="input"
              value={serverUrl}
              placeholder="https://watch-party-sync-server.onrender.com"
              onChange={(event) => setServerUrl(event.target.value)}
            />
            <button className="button button-primary" type="button" onClick={saveServerUrl}>
              Save
            </button>
          </div>
          {saved ? (
            <span className="badge badge-success">
              <CheckCircle2 size={14} />
              Saved
            </span>
          ) : null}
          {error ? <span className="error">{error}</span> : null}
        </section>

        <section className="panel stack">
          <h2 className="section-title">Debug</h2>
          <label className="row">
            <input
              type="checkbox"
              checked={Boolean(state?.debug)}
              onChange={(event) => setDebug(event.target.checked)}
            />
            Show drift and clock offset in the overlay
          </label>
        </section>

        <section className="panel stack">
          <div className="row">
            <Shield size={18} />
            <h2 className="section-title">Privacy boundary</h2>
          </div>
          <p className="privacy-note">
            The extension syncs playback controls only. It does not stream, download, capture, share
            sessions, read cookies, or bypass provider restrictions. Every viewer must be able to
            play the video in their own browser.
          </p>
        </section>
      </div>
    </main>
  );
}

async function send<T>(message: RuntimeRequest): Promise<RuntimeResponse<T>> {
  return browser.runtime.sendMessage(message);
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Options root element not found.");
}

createRoot(rootElement).render(
  <React.StrictMode>
    <OptionsApp />
  </React.StrictMode>,
);
