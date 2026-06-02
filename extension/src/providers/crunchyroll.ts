import type { MediaKey } from "@watch-party-sync/protocol";
import { BaseVideoAdapter, normalizeUrlKey } from "./base-video-adapter";

export class CrunchyrollAdapter extends BaseVideoAdapter {
  readonly id = "crunchyroll" as const;

  async getMediaKey(): Promise<MediaKey> {
    const parsed = new URL(location.href);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const stablePath = parts.join(":") || normalizeUrlKey();

    return {
      providerId: this.id,
      id: stablePath,
      url: normalizeUrlKey(),
      title: document.title || undefined,
    };
  }
}
