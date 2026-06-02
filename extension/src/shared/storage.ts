import { browser } from "wxt/browser";
import { DEFAULT_SERVER_URL, normalizeServerUrl } from "./server-permissions";

const LEGACY_LOCAL_SERVER_URL = "http://localhost:8787";
const SERVER_URL_DEFAULT_MIGRATED_KEY = "serverUrlDefaultMigrated";

export type StoredSettings = {
  serverUrl: string;
  memberId: string;
  displayName: string;
  debug: boolean;
};

export async function loadSettings(): Promise<StoredSettings> {
  const stored = await browser.storage.local.get([
    "serverUrl",
    "memberId",
    "displayName",
    "debug",
    SERVER_URL_DEFAULT_MIGRATED_KEY,
  ]);
  const memberId = typeof stored.memberId === "string" ? stored.memberId : crypto.randomUUID();

  if (!stored.memberId) {
    await browser.storage.local.set({ memberId });
  }

  const serverUrl = await resolveServerUrl(stored);

  return {
    serverUrl,
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

async function resolveServerUrl(stored: Record<string, unknown>) {
  const hasMigrated = stored[SERVER_URL_DEFAULT_MIGRATED_KEY] === true;
  const storedServerUrl =
    typeof stored.serverUrl === "string" ? normalizeServerUrl(stored.serverUrl) : undefined;

  if (!hasMigrated && (!storedServerUrl || storedServerUrl === LEGACY_LOCAL_SERVER_URL)) {
    await browser.storage.local.set({
      serverUrl: DEFAULT_SERVER_URL,
      [SERVER_URL_DEFAULT_MIGRATED_KEY]: true,
    });
    return DEFAULT_SERVER_URL;
  }

  if (!hasMigrated) {
    await browser.storage.local.set({ [SERVER_URL_DEFAULT_MIGRATED_KEY]: true });
  }

  return storedServerUrl ?? DEFAULT_SERVER_URL;
}
