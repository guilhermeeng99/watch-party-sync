import {
  type PlaybackCommand,
  calculateNudgedRate,
  calculateTargetPosition,
  classifyDrift,
} from "@watch-party-sync/protocol";
import type { ProviderAdapter } from "../providers/types";

// How long a drift rate-nudge stays applied before restoring the room's base rate. Long enough
// to close sub-second drift at a few percent speed delta, short enough to feel transparent.
const RATE_RESTORE_MS = 4000;

export async function applyPlaybackCommand(
  adapter: ProviderAdapter,
  command: PlaybackCommand,
  serverOffsetMs: number,
) {
  const delayMs = Math.max(0, command.applyAt - getServerTime(serverOffsetMs));
  window.setTimeout(() => {
    applyNow(adapter, command, serverOffsetMs).catch(() => undefined);
  }, delayMs);
}

async function applyNow(
  adapter: ProviderAdapter,
  command: PlaybackCommand,
  serverOffsetMs: number,
) {
  const state = await adapter.getState();
  const nowServerMs = getServerTime(serverOffsetMs);
  const targetPosition = calculateTargetPosition(command, nowServerMs);
  const driftMs = (state.currentTime - targetPosition) * 1000;
  const decision = classifyDrift(driftMs, command.paused);

  if (decision === "seek") {
    await adapter.seek(targetPosition);
  }

  if (command.type === "rate" || state.playbackRate !== command.playbackRate) {
    await adapter.setPlaybackRate(command.playbackRate);
  }

  if (command.paused) {
    await adapter.pause();
    return;
  }

  if (decision === "rate-nudge") {
    const nudgedRate = calculateNudgedRate(command.playbackRate, driftMs);
    await adapter.setPlaybackRate(nudgedRate);
    window.setTimeout(() => {
      adapter.setPlaybackRate(command.playbackRate).catch(() => undefined);
    }, RATE_RESTORE_MS);
  }

  await adapter.play();
}

function getServerTime(serverOffsetMs: number) {
  return Date.now() + serverOffsetMs;
}
