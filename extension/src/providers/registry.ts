import { CrunchyrollAdapter } from "./crunchyroll";
import { GenericHtml5Adapter } from "./generic-html5";
import type { ProviderAdapter } from "./types";
import { YouTubeAdapter } from "./youtube";

export async function createProviderAdapter(): Promise<ProviderAdapter | undefined> {
  const host = location.hostname;

  if (host === "www.youtube.com" || host === "youtube.com") {
    return new YouTubeAdapter();
  }

  if (host.endsWith("crunchyroll.com")) {
    return new CrunchyrollAdapter();
  }

  if (host === "localhost" || host === "127.0.0.1") {
    return new GenericHtml5Adapter();
  }

  return undefined;
}
