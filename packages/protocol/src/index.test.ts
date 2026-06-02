import { describe, expect, it } from "vitest";
import {
  type PlaybackCommand,
  calculateNudgedRate,
  calculateTargetPosition,
  canRequestControl,
  classifyDrift,
  estimateClockOffset,
} from "./index.js";

const command: PlaybackCommand = {
  commandId: "cmd-1",
  type: "play",
  mediaKey: { providerId: "youtube", id: "abc" },
  position: 10,
  playbackRate: 1,
  paused: false,
  issuedAt: 1000,
  applyAt: 2000,
  issuerMemberId: "member-1",
  reason: "user",
};

describe("sync helpers", () => {
  it("calculates target position for playing commands", () => {
    expect(calculateTargetPosition(command, 4500)).toBe(12.5);
  });

  it("keeps paused commands fixed at their position", () => {
    expect(calculateTargetPosition({ ...command, paused: true }, 4500)).toBe(10);
  });

  it("classifies drift thresholds", () => {
    expect(classifyDrift(100, false)).toBe("none");
    expect(classifyDrift(800, false)).toBe("rate-nudge");
    expect(classifyDrift(800, true)).toBe("seek");
    expect(classifyDrift(2000, false)).toBe("seek");
  });

  it("nudges rate toward the target", () => {
    expect(calculateNudgedRate(1, -900)).toBeGreaterThan(1);
    expect(calculateNudgedRate(1, 900)).toBeLessThan(1);
  });

  it("estimates clock offset from ping pong timestamps", () => {
    expect(estimateClockOffset(100, 180, 140)).toEqual({ rtt: 40, offset: 60 });
  });

  it("enforces friend and host control policy", () => {
    expect(canRequestControl("friend", "member", "pause")).toBe(true);
    expect(canRequestControl("friend", "member", "seek")).toBe(false);
    expect(canRequestControl("host", "member", "pause")).toBe(false);
    expect(canRequestControl("host", "host", "seek")).toBe(true);
  });
});
