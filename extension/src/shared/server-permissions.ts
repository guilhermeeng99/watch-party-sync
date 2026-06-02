import { browser } from "wxt/browser";

const DEFAULT_SERVER_URL = "http://localhost:8787";

export function normalizeServerUrl(serverUrl: string) {
  return serverUrl.trim().replace(/\/+$/, "") || DEFAULT_SERVER_URL;
}

export function serverUrlToOriginPattern(serverUrl: string) {
  try {
    const url = new URL(normalizeServerUrl(serverUrl));
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return undefined;
    }

    return `${url.protocol}//${url.hostname}/*`;
  } catch {
    return undefined;
  }
}

export async function hasServerHostAccess(serverUrl: string) {
  const origin = serverUrlToOriginPattern(serverUrl);
  if (!origin) {
    return false;
  }

  return browser.permissions.contains({ origins: [origin] });
}

export async function requestServerHostAccess(serverUrl: string) {
  const origin = serverUrlToOriginPattern(serverUrl);
  if (!origin) {
    return false;
  }

  const alreadyGranted = await browser.permissions.contains({ origins: [origin] });
  if (alreadyGranted) {
    return true;
  }

  return browser.permissions.request({ origins: [origin] });
}
