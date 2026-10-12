import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rateLimiter.ts";

const createClock = () => {
  let current = 1_000_000;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
};

describe("createRateLimiter", () => {
  it("allows a burst up to the capacity, then asks to wait", () => {
    const clock = createClock();
    const limiter = createRateLimiter({
      capacity: 3,
      refillPerSecond: 1,
      now: clock.now,
    });

    expect(limiter.consume("a")).toBeUndefined();
    expect(limiter.consume("a")).toBeUndefined();
    expect(limiter.consume("a")).toBeUndefined();
    expect(limiter.consume("a")).toBe(1);
  });

  it("refills over time", () => {
    const clock = createClock();
    const limiter = createRateLimiter({
      capacity: 1,
      refillPerSecond: 0.5,
      now: clock.now,
    });

    limiter.consume("a");
    expect(limiter.consume("a")).toBe(2);
    clock.advance(1000);
    expect(limiter.consume("a")).toBe(1);
    clock.advance(1000);
    expect(limiter.consume("a")).toBeUndefined();
  });

  it("keeps keys apart", () => {
    const limiter = createRateLimiter({ capacity: 1, refillPerSecond: 1 });

    limiter.consume("a");

    expect(limiter.consume("a")).toBe(1);
    expect(limiter.consume("b")).toBeUndefined();
  });

  it("reports the wait without taking a request", () => {
    const clock = createClock();
    const limiter = createRateLimiter({
      capacity: 1,
      refillPerSecond: 1,
      now: clock.now,
    });

    expect(limiter.retryAfter("a")).toBeUndefined();
    expect(limiter.retryAfter("a")).toBeUndefined();
    limiter.consume("a");
    expect(limiter.retryAfter("a")).toBe(1);
  });
});
