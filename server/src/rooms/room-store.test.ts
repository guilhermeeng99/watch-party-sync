import { describe, expect, it } from "vitest";
import { RoomStore } from "./room-store.js";

const mediaKey = { providerId: "youtube" as const, id: "abc123", title: "Episode" };

function createStore(now = 1000) {
  return new RoomStore({
    roomTtlMs: 60_000,
    emptyRoomTtlMs: 5000,
    commandDelayMs: 1500,
    now: () => now,
  });
}

describe("RoomStore", () => {
  it("creates a room and assigns host", () => {
    const store = createStore();
    const result = store.createRoom(
      { memberId: "host-1", displayName: "Host", mode: "friend", mediaKey },
      "socket-1",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.hostMemberId).toBe("host-1");
    expect(result.value.members[0]?.role).toBe("host");
  });

  it("rejects joining a room with different media", () => {
    const store = createStore();
    const created = store.createRoom(
      { memberId: "host-1", displayName: "Host", mode: "friend", mediaKey },
      "socket-1",
    );
    if (!created.ok) throw new Error("setup failed");

    const result = store.joinRoom(
      {
        roomCode: created.value.code,
        memberId: "member-1",
        displayName: "Friend",
        mediaKey: { providerId: "youtube", id: "other" },
      },
      "socket-2",
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("media_mismatch");
  });

  it("allows friend mode members to pause but not seek", () => {
    const store = createStore();
    const created = store.createRoom(
      { memberId: "host-1", displayName: "Host", mode: "friend", mediaKey },
      "socket-1",
    );
    if (!created.ok) throw new Error("setup failed");

    store.joinRoom(
      { roomCode: created.value.code, memberId: "member-1", displayName: "Friend", mediaKey },
      "socket-2",
    );

    const pause = store.requestControl({
      roomCode: created.value.code,
      memberId: "member-1",
      type: "pause",
      position: 12,
    });
    const seek = store.requestControl({
      roomCode: created.value.code,
      memberId: "member-1",
      type: "seek",
      position: 42,
    });

    expect(pause.ok).toBe(true);
    expect(seek.ok).toBe(false);
  });

  it("schedules commands in the future", () => {
    const store = createStore();
    const created = store.createRoom(
      { memberId: "host-1", displayName: "Host", mode: "host", mediaKey },
      "socket-1",
    );
    if (!created.ok) throw new Error("setup failed");

    const command = store.requestControl({
      roomCode: created.value.code,
      memberId: "host-1",
      type: "play",
      position: 0,
    });

    expect(command.ok).toBe(true);
    if (!command.ok) return;
    expect(command.value.issuedAt).toBe(1000);
    expect(command.value.applyAt).toBe(2500);
  });
});
