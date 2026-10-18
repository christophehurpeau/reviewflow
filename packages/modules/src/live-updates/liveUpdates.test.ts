import { describe, expect, it } from "vitest";
import { getLiveUpdatesPausedBy, isLiveUpdatesPaused } from "./liveUpdates.ts";

describe("isLiveUpdatesPaused", () => {
  it("is true only for a paused status", () => {
    expect(isLiveUpdatesPaused({ total: 1, liveUpdates: "paused" })).toBe(true);
    expect(isLiveUpdatesPaused({ total: 1, liveUpdates: "live" })).toBe(false);
    expect(isLiveUpdatesPaused({ total: 1 })).toBe(false);
    expect(isLiveUpdatesPaused(undefined)).toBe(false);
  });
});

describe("getLiveUpdatesPausedBy", () => {
  it("names the limit that paused the live updates", () => {
    expect(
      getLiveUpdatesPausedBy({
        liveUpdates: "paused",
        liveUpdatesPausedBy: "userLimit",
      }),
    ).toBe("userLimit");
    expect(
      getLiveUpdatesPausedBy({
        liveUpdates: "paused",
        liveUpdatesPausedBy: "serverLimit",
      }),
    ).toBe("serverLimit");
  });

  it("falls back on the server limit when the reason is missing", () => {
    expect(getLiveUpdatesPausedBy({ liveUpdates: "paused" })).toBe(
      "serverLimit",
    );
  });

  it("is undefined while live", () => {
    expect(getLiveUpdatesPausedBy({ liveUpdates: "live" })).toBeUndefined();
    expect(getLiveUpdatesPausedBy(undefined)).toBeUndefined();
  });
});
