import { browser } from "wxt/browser";
import { normalizeServerUrl } from "./server-permissions";

const DEFAULT_SERVER_URL = "http://localhost:8787";

export type StoredSettings = {
  serverUrl: string;
  memberId: string;
  displayName: string;
  debug: boolean;
};

export async function loadSettings(): Promise<StoredSettings> {
  const stored = await browser.storage.local.get(["serverUrl", "memberId", "displayName", "debug"]);
  const memberId = typeof stored.memberId === "string" ? stored.memberId : crypto.randomUUID();

  if (!stored.memberId) {
    await browser.storage.local.set({ memberId });
  }

  return {
    serverUrl:
      typeof stored.serverUrl === "string"
        ? normalizeServerUrl(stored.serverUrl)
        : DEFAULT_SERVER_URL,
    memberId,
    displayName: typeof stored.displayName === "string" ? stored.displayName : "Friend",
    debug: typeof stored.debug === "boolean" ? stored.debug : false,
  };
}

export async function saveSetting<K extends keyof StoredSettings>(
  key: K,
  value: StoredSettings[K],
) {
  await browser.storage.local.set({ [key]: value });
}
