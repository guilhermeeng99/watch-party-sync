import { createProviderAdapter } from "../src/providers/registry";
import type { ProviderAdapter } from "../src/providers/types";
import { type RuntimeRequest, fail, ok } from "../src/shared/runtime-messages";
import { applyPlaybackCommand } from "../src/sync/apply-command";
import { renderOverlay } from "../src/ui/overlay";

export default defineContentScript({
  matches: ["https://www.youtube.com/*", "https://www.crunchyroll.com/*"],
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
        return adapter
          ? applyPlaybackCommand(adapter, message.command, serverOffsetMs).then(() => ok(true))
          : Promise.resolve(fail("No provider adapter for this page."));
      }

      if (message.type === "content:set-room-state") {
        serverOffsetMs = message.state.serverOffsetMs;
        renderOverlay(message.state);
        return Promise.resolve(ok(true));
      }

      return undefined;
    });
  },
});

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
        browser.runtime
          .sendMessage({
            type: "content:player-state",
            state: { ...event.state, capturedAt: Date.now() },
          } satisfies RuntimeRequest)
          .catch(() => undefined);
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
