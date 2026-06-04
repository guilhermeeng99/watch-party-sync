import type { MediaKey } from "@watch-party-sync/protocol";
import { BaseVideoAdapter } from "./base-video-adapter";

export class YouTubeAdapter extends BaseVideoAdapter {
  readonly id = "youtube" as const;

  // YouTube is a single-page app that swaps videos via its own router without a popstate, so we
  // listen for its bespoke navigation event to re-detect the media. Kept here, not in the base.
  protected registerMediaChangeSources(onMediaChange: () => void, signal: AbortSignal) {
    document.addEventListener("yt-navigate-finish", onMediaChange, { signal });
  }

  async getMediaKey(): Promise<MediaKey> {
    const id = readYouTubeVideoId();
    if (!id) {
      throw new Error("Could not read YouTube video id.");
    }

    return {
      providerId: this.id,
      id,
      url: `https://www.youtube.com/watch?v=${id}`,
      title: document.title || undefined,
    };
  }
}

export function readYouTubeVideoId(url = location.href): string | undefined {
  const parsed = new URL(url);
  if (parsed.pathname === "/watch") {
    return parsed.searchParams.get("v") ?? undefined;
  }

  const parts = parsed.pathname.split("/").filter(Boolean);
  if ((parts[0] === "shorts" || parts[0] === "embed") && parts[1]) {
    return parts[1];
  }

  return undefined;
}
