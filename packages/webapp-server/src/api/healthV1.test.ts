import { describe, expect, it } from "vitest";
import { toHealthV1 } from "./health.ts";

const now = Date.parse("2026-01-01T00:01:00Z");
const secondsAgo = (seconds: number): Date => new Date(now - seconds * 1000);

describe("toHealthV1", () => {
  it("is ok when the relay is live and a message is recent", () => {
    expect(
      toHealthV1("ok", { isLive: true, lastMessageAt: secondsAgo(12) }, now),
    ).toEqual({ status: "ok", propagation: "ok", lagSeconds: 12 });
  });

  it("stays ok just below two heartbeat intervals", () => {
    expect(
      toHealthV1("ok", { isLive: true, lastMessageAt: secondsAgo(29.9) }, now),
    ).toEqual({ status: "ok", propagation: "ok", lagSeconds: 29 });
  });

  it("is lagging at two heartbeat intervals of silence", () => {
    expect(
      toHealthV1("ok", { isLive: true, lastMessageAt: secondsAgo(30) }, now),
    ).toEqual({ status: "degraded", propagation: "lagging", lagSeconds: 30 });
  });

  it("is lagging when the relay is not live, even with a recent message", () => {
    expect(
      toHealthV1("ok", { isLive: false, lastMessageAt: secondsAgo(1) }, now),
    ).toEqual({ status: "degraded", propagation: "lagging", lagSeconds: 1 });
  });

  it("is lagging with a null lag when no message arrived yet", () => {
    expect(
      toHealthV1("ok", { isLive: true, lastMessageAt: null }, now),
    ).toEqual({ status: "degraded", propagation: "lagging", lagSeconds: null });
  });

  it("keeps a degraded status when the relay is fine", () => {
    expect(
      toHealthV1(
        "degraded",
        { isLive: true, lastMessageAt: secondsAgo(2) },
        now,
      ),
    ).toEqual({ status: "degraded", propagation: "ok", lagSeconds: 2 });
  });

  it("never reports a negative lag on clock skew", () => {
    expect(
      toHealthV1("ok", { isLive: true, lastMessageAt: secondsAgo(-3) }, now),
    ).toEqual({ status: "ok", propagation: "ok", lagSeconds: 0 });
  });
});
