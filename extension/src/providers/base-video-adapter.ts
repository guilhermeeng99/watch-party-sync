import type { MediaKey, ProviderId } from "@watch-party-sync/protocol";
import type { ProviderDetection } from "../shared/runtime-messages";
import type { PlayerEvent, PlayerEventTrigger, ProviderAdapter } from "./types";

const PLAYER_EVENTS: PlayerEventTrigger[] = [
  "play",
  "pause",
  "seeked",
  "ratechange",
  "loadedmetadata",
  "durationchange",
];

export abstract class BaseVideoAdapter implements ProviderAdapter {
  abstract readonly id: ProviderId;
  private lastMediaId?: string;

  async detect(): Promise<ProviderDetection> {
    const video = await this.waitForVideo();
    if (!video) {
      return {
        supported: false,
        providerId: this.id,
        reason: "No controllable video player found.",
      };
    }

    return {
      supported: true,
      providerId: this.id,
      mediaKey: await this.getMediaKey(),
      title: document.title || undefined,
    };
  }

  abstract getMediaKey(): Promise<MediaKey>;

  async getState() {
    const video = this.requireVideo();
    return {
      mediaKey: await this.getMediaKey(),
      paused: video.paused,
      currentTime: Math.max(0, video.currentTime || 0),
      duration: Number.isFinite(video.duration) && video.duration > 0 ? video.duration : undefined,
      playbackRate: video.playbackRate || 1,
      bufferedEnd: readBufferedEnd(video),
      capturedAt: Date.now(),
    };
  }

  async play() {
    await this.requireVideo().play();
  }

  async pause() {
    this.requireVideo().pause();
  }

  async seek(seconds: number) {
    this.requireVideo().currentTime = Math.max(0, seconds);
  }

  async setPlaybackRate(rate: number) {
    this.requireVideo().playbackRate = clamp(rate, 0.25, 4);
  }

  subscribe(listener: (event: PlayerEvent) => void) {
    const controller = new AbortController();
    const emitState = (trigger: PlayerEventTrigger) => {
      this.getState()
        .then((state) => listener({ type: "state", state, trigger }))
        .catch((error) =>
          listener({ type: "error", code: "state_failed", message: String(error) }),
        );
    };
    const emitMediaChange = () => {
      this.getMediaKey()
        .then((mediaKey) => {
          if (mediaKey.id !== this.lastMediaId) {
            this.lastMediaId = mediaKey.id;
            listener({ type: "mediachange", mediaKey });
          }
        })
        .catch(() => undefined);
    };

    for (const eventName of PLAYER_EVENTS) {
      this.requireVideo().addEventListener(eventName, () => emitState(eventName), {
        signal: controller.signal,
      });
    }

    // popstate is the generic SPA navigation signal; provider-specific signals are added by the
    // concrete adapter so YouTube/Crunchyroll page quirks don't leak into this shared base.
    window.addEventListener("popstate", emitMediaChange, { signal: controller.signal });
    this.registerMediaChangeSources(emitMediaChange, controller.signal);
    const intervalId = window.setInterval(() => {
      emitState("interval");
      emitMediaChange();
    }, 1000);

    return () => {
      controller.abort();
      window.clearInterval(intervalId);
    };
  }

  dispose() {}

  // Hook for provider-specific media-change signals (e.g. framework SPA navigation events).
  // Base wires only the generic popstate; subclasses override to add their own listeners.
  protected registerMediaChangeSources(_onMediaChange: () => void, _signal: AbortSignal) {}

  protected findVideo(): HTMLVideoElement | undefined {
    const videos = [...document.querySelectorAll("video")];
    return videos
      .filter((video) => video.offsetWidth > 120 && video.offsetHeight > 80)
      .sort(
        (left, right) =>
          right.offsetWidth * right.offsetHeight - left.offsetWidth * left.offsetHeight,
      )[0];
  }

  protected async waitForVideo(timeoutMs = 10_000): Promise<HTMLVideoElement | undefined> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const video = this.findVideo();
      if (video) {
        return video;
      }
      await delay(250);
    }

    return undefined;
  }

  protected requireVideo(): HTMLVideoElement {
    const video = this.findVideo();
    if (!video) {
      throw new Error("No controllable video player found.");
    }
    return video;
  }
}

export function normalizeUrlKey(url = location.href): string {
  const parsed = new URL(url);
  parsed.hash = "";
  parsed.searchParams.sort();
  return parsed.toString();
}

function readBufferedEnd(video: HTMLVideoElement): number | undefined {
  if (video.buffered.length === 0) {
    return undefined;
  }

  return video.buffered.end(video.buffered.length - 1);
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
