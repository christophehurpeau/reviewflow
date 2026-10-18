import { describe, expect, it } from "vitest";
import { isLiveUpdatesPaused } from "./liveUpdates.ts";

describe("isLiveUpdatesPaused", () => {
  it("is true only for a paused status", () => {
    expect(isLiveUpdatesPaused({ total: 1, liveUpdates: "paused" })).toBe(true);
    expect(isLiveUpdatesPaused({ total: 1, liveUpdates: "live" })).toBe(false);
    expect(isLiveUpdatesPaused({ total: 1 })).toBe(false);
    expect(isLiveUpdatesPaused(undefined)).toBe(false);
  });
});
