import type { MediaKey } from "@watch-party-sync/protocol";
import { BaseVideoAdapter, normalizeUrlKey } from "./base-video-adapter";

export class GenericHtml5Adapter extends BaseVideoAdapter {
  readonly id = "generic-html5" as const;

  async getMediaKey(): Promise<MediaKey> {
    const video = this.requireVideo();
    const src = video.currentSrc || video.src || normalizeUrlKey();
    return {
      providerId: this.id,
      id: `${normalizeUrlKey()}::${src}`,
      url: normalizeUrlKey(),
      title: document.title || undefined,
    };
  }
}
