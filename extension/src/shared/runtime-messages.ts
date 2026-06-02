import type {
  MediaKey,
  PlaybackCommand,
  PlayerState,
  RoomMode,
  RoomSnapshot,
} from "@watch-party-sync/protocol";

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "reconnecting";

export type ProviderDetection =
  | {
      supported: true;
      providerId: MediaKey["providerId"];
      mediaKey: MediaKey;
      title?: string;
    }
  | {
      supported: false;
      providerId?: MediaKey["providerId"];
      reason: string;
    };

export type ExtensionState = {
  serverUrl: string;
  memberId: string;
  displayName: string;
  debug: boolean;
  connectionStatus: ConnectionStatus;
  activeTabId?: number;
  provider?: ProviderDetection;
  player?: PlayerState;
  room?: RoomSnapshot;
  serverOffsetMs: number;
  lastError?: string;
};

export type RuntimeRequest =
  | { type: "popup:get-state" }
  | { type: "popup:set-profile"; displayName: string }
  | { type: "popup:set-server-url"; serverUrl: string }
  | { type: "popup:set-debug"; debug: boolean }
  | { type: "popup:refresh-active-tab" }
  | { type: "popup:create-room"; mode: RoomMode }
  | { type: "popup:join-room"; roomCode: string }
  | { type: "popup:leave-room" }
  | { type: "popup:set-ready"; ready: boolean }
  | {
      type: "popup:control";
      command: "play" | "pause" | "seek" | "rate";
      position?: number;
      playbackRate?: number;
    }
  | { type: "content:get-detection" }
  | { type: "content:get-state" }
  | { type: "content:apply-command"; command: PlaybackCommand; serverOffsetMs: number }
  | { type: "content:set-room-state"; state: ExtensionState }
  | { type: "content:provider-detected"; detection: ProviderDetection }
  | { type: "content:player-state"; state: PlayerState }
  | { type: "content:media-change"; mediaKey: MediaKey }
  | { type: "content:error"; message: string };

export type RuntimeResponse<T = unknown> =
  | { ok: true; value: T }
  | { ok: false; message: string; code?: string };

export function ok<T>(value: T): RuntimeResponse<T> {
  return { ok: true, value };
}

export function fail(message: string, code?: string): RuntimeResponse<never> {
  return { ok: false, message, code };
}
