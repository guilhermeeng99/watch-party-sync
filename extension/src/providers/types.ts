import type { MediaKey, PlayerState, ProviderId } from "@watch-party-sync/protocol";
import type { ProviderDetection } from "../shared/runtime-messages";

export type PlayerEvent =
  | { type: "state"; state: PlayerState }
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
