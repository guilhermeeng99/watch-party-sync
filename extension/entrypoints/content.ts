import type { PlayerState } from "@watch-party-sync/protocol";
import { createProviderAdapter } from "../src/providers/registry";
import type { PlayerEventTrigger, ProviderAdapter } from "../src/providers/types";
import { type RuntimeRequest, fail, ok } from "../src/shared/runtime-messages";
import { applyPlaybackCommand } from "../src/sync/apply-command";
import { renderOverlay } from "../src/ui/overlay";

// How long to ignore native player events after we apply a remote command.
// Applying a command fires the same play/pause/seeked events; without this window
// every applied command would echo back as a fresh user intent and loop the room.
const INTENT_ECHO_GUARD_MS = 1500;

// Drop repeated intents of the same type fired within this window (e.g. double "play").
const INTENT_DEDUPE_MS = 400;

// DOM triggers that map to a deliberate user control we should broadcast.
// "ratechange" is intentionally excluded: drift correction nudges the rate internally and
// restores it after the echo-guard window, which would otherwise rebroadcast as a fake intent.
const INTENT_BY_TRIGGER: Partial<Record<PlayerEventTrigger, "play" | "pause" | "seek">> = {
  play: "play",
  pause: "pause",
  seeked: "seek",
};

export default defineContentScript({
  matches: ["https://www.youtube.com/*", "https://youtube.com/*", "https://www.crunchyroll.com/*"],
  async main() {
    const adapter = await initializeAdapter();
    let serverOffsetMs = 0;

    browser.runtime.onMessage.addListener((message: RuntimeRequest) => {
      if (message.type === "content:get-detection") {
        return adapter
          ? adapter
              .detect()
              .then(ok)
              .catch((error) => fail(String(error)))
          : Promise.resolve(ok({ supported: false, reason: "No provider adapter for this page." }));
      }

      if (message.type === "content:get-state") {
        return adapter
          ? adapter
              .getState()
              .then((state) => ok({ ...state, capturedAt: Date.now() + serverOffsetMs }))
          : Promise.resolve(fail("No provider adapter for this page."));
      }

      if (message.type === "content:apply-command") {
        serverOffsetMs = message.serverOffsetMs;
        // Suppress intent until after the command actually applies on the player.
        const localApplyAt = message.command.applyAt - serverOffsetMs;
        suppressIntentUntil(localApplyAt + INTENT_ECHO_GUARD_MS);
        return adapter
          ? applyPlaybackCommand(adapter, message.command, serverOffsetMs).then(() => ok(true))
          : Promise.resolve(fail("No provider adapter for this page."));
      }

      if (message.type === "content:set-room-state") {
        serverOffsetMs = message.state.serverOffsetMs;
        inRoom = Boolean(message.state.room);
        renderOverlay(message.state);
        return Promise.resolve(ok(true));
      }

      return undefined;
    });
  },
});

// Module-scope sync guards. Shared by the adapter subscription below and the message handler.
let inRoom = false;
let echoGuardUntil = 0;
let lastIntent: { command: string; at: number } | undefined;

function suppressIntentUntil(timestamp: number) {
  echoGuardUntil = Math.max(echoGuardUntil, timestamp);
}

function shouldBroadcastIntent(command: "play" | "pause" | "seek" | "rate"): boolean {
  if (!inRoom) {
    return false;
  }

  const now = Date.now();
  if (now < echoGuardUntil) {
    return false;
  }

  if (lastIntent && lastIntent.command === command && now - lastIntent.at < INTENT_DEDUPE_MS) {
    return false;
  }

  lastIntent = { command, at: now };
  return true;
}

async function initializeAdapter(): Promise<ProviderAdapter | undefined> {
  const adapter = await createProviderAdapter();
  if (!adapter) {
    await browser.runtime.sendMessage({
      type: "content:provider-detected",
      detection: { supported: false, reason: "Unsupported page." },
    } satisfies RuntimeRequest);
    return undefined;
  }

  const detection = await adapter.detect();
  await browser.runtime.sendMessage({
    type: "content:provider-detected",
    detection,
  } satisfies RuntimeRequest);

  if (detection.supported) {
    adapter.subscribe((event) => {
      if (event.type === "state") {
        forwardState(event.state);
        maybeForwardIntent(event.trigger, event.state);
      }

      if (event.type === "mediachange") {
        browser.runtime
          .sendMessage({
            type: "content:media-change",
            mediaKey: event.mediaKey,
          } satisfies RuntimeRequest)
          .catch(() => undefined);
      }

      if (event.type === "error") {
        browser.runtime
          .sendMessage({ type: "content:error", message: event.message } satisfies RuntimeRequest)
          .catch(() => undefined);
      }
    });
  }

  return adapter;
}

function forwardState(state: PlayerState) {
  browser.runtime
    .sendMessage({
      type: "content:player-state",
      state: { ...state, capturedAt: Date.now() },
    } satisfies RuntimeRequest)
    .catch(() => undefined);
}

// Turn a deliberate native player action into a room control request.
function maybeForwardIntent(trigger: PlayerEventTrigger, state: PlayerState) {
  const command = INTENT_BY_TRIGGER[trigger];
  if (!command || !shouldBroadcastIntent(command)) {
    return;
  }

  browser.runtime
    .sendMessage({
      type: "content:user-intent",
      command,
      position: state.currentTime,
      playbackRate: state.playbackRate,
    } satisfies RuntimeRequest)
    .catch(() => undefined);
}
