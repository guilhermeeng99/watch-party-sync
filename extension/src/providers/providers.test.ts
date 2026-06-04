import { describe, expect, it } from "vitest";
import { normalizeUrlKey } from "./base-video-adapter";
import { readYouTubeVideoId } from "./youtube";

describe("readYouTubeVideoId", () => {
  it("reads the v param from a watch URL", () => {
    expect(readYouTubeVideoId("https://www.youtube.com/watch?v=abc123")).toBe("abc123");
  });

  it("reads ids from shorts and embed paths", () => {
    expect(readYouTubeVideoId("https://www.youtube.com/shorts/xyz789")).toBe("xyz789");
    expect(readYouTubeVideoId("https://www.youtube.com/embed/embed42")).toBe("embed42");
  });

  it("returns undefined when there is no video id", () => {
    expect(readYouTubeVideoId("https://www.youtube.com/feed/subscriptions")).toBeUndefined();
    expect(readYouTubeVideoId("https://www.youtube.com/watch")).toBeUndefined();
  });
});

describe("normalizeUrlKey", () => {
  it("drops the hash and sorts query params for a stable key", () => {
    expect(normalizeUrlKey("https://example.com/watch?b=2&a=1#t=10")).toBe(
      "https://example.com/watch?a=1&b=2",
    );
  });

  it("produces the same key regardless of original param order", () => {
    expect(normalizeUrlKey("https://example.com/p?z=1&a=2")).toBe(
      normalizeUrlKey("https://example.com/p?a=2&z=1"),
    );
  });
});
