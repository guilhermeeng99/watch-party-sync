import type { MediaKey, PlayerState, ProviderId } from "@watch-party-sync/protocol";
import type { ProviderDetection } from "../shared/runtime-messages";

// The DOM media event (or "interval"/"snapshot") that produced a state emission.
// The content script uses this to tell deliberate user actions apart from passive polling.
export type PlayerEventTrigger =
  | "play"
  | "pause"
  | "seeked"
  | "ratechange"
  | "loadedmetadata"
  | "durationchange"
  | "interval";

export type PlayerEvent =
  | { type: "state"; state: PlayerState; trigger: PlayerEventTrigger }
  | { type: "mediachange"; mediaKey: MediaKey }
  | { type: "error"; code: string; message: string };

export type Unsubscribe = () => void;

export interface ProviderAdapter {
  id: ProviderId;
  detect(): Promise<ProviderDetection>;
  getMediaKey(): Promise<MediaKey>;
  getState(): Promise<PlayerState>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(seconds: number): Promise<void>;
  setPlaybackRate(rate: number): Promise<void>;
  subscribe(listener: (event: PlayerEvent) => void): Unsubscribe;
  dispose(): void;
}
