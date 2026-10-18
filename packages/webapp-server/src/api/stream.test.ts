import type { Mock } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Query, SubscribeCallback } from "liwi-store";
import type { ReviewflowPr } from "reviewflow-core";
import type { PrDetail } from "reviewflow-modules";
import type { StreamEvent } from "./stream.ts";
import { openPrStream, parseClosedWithinDays } from "./stream.ts";

/** the fields the stream reads; the rest of a `PrDetail` is passed through */
const detail = (id: string, overrides: Partial<PrDetail> = {}): PrDetail => {
  const fields: Partial<PrDetail> = {
    _id: id,
    title: `title of ${id}`,
    state: "open",
    updatedAt: "2026-10-18T10:00:00.000Z",
    ...overrides,
  };
  return fields as PrDetail;
};

const storedPr = (id: string, isClosed: boolean): ReviewflowPr => {
  const fields: Partial<ReviewflowPr> = { _id: id, isClosed };
  return fields as ReviewflowPr;
};

interface Harness {
  emit: SubscribeCallback<string, PrDetail[]>;
  events: StreamEvent[];
  end: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  readPr: Mock<(id: string) => Promise<ReviewflowPr | undefined>>;
}

const openWith = (stored: Record<string, ReviewflowPr | undefined> = {}) => {
  let emit: SubscribeCallback<string, PrDetail[]> | undefined;
  const stop = vi.fn();
  const query = {
    fetchAndSubscribe: (callback: SubscribeCallback<string, PrDetail[]>) => {
      emit = callback;
      return {
        stop,
        cancel: stop,
        then: (onFulfilled?: () => unknown) =>
          Promise.resolve().then(onFulfilled),
      };
    },
  } as unknown as Query<PrDetail[], any>;
  const events: StreamEvent[] = [];
  const end = vi.fn();
  const readPr = vi.fn((id: string): Promise<ReviewflowPr | undefined> =>
    Promise.resolve(stored[id]),
  );

  openPrStream({
    query,
    readPr,
    toPrDetail: (pr) =>
      detail(pr._id, { state: pr.isClosed ? "closed" : "open" }),
    send: (event) => events.push(event),
    end,
    coalesceMs: 1000,
  });

  const harness: Harness = { emit: emit!, events, end, stop, readPr };
  return harness;
};

const snapshot = (harness: Harness, details: PrDetail[]): void => {
  harness.emit(null, [
    {
      type: "initial",
      initial: details,
      meta: { total: details.length },
      queryInfo: {} as any,
    },
  ]);
};

const names = (events: StreamEvent[]): string[] =>
  events.map((event) =>
    event.event === "pr" || event.event === "prRemoved"
      ? `${event.event}:${event.data._id}`
      : event.event,
  );

describe("openPrStream", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends the scope, then ready", () => {
    const harness = openWith();
    snapshot(harness, [detail("a"), detail("b")]);

    expect(names(harness.events)).toEqual(["pr:a", "pr:b", "ready"]);
  });

  it("sends the latest state of a pull request once per coalescing window", () => {
    const harness = openWith();
    snapshot(harness, [detail("a")]);
    harness.events.length = 0;

    harness.emit(null, [
      { type: "updated", result: [detail("a", { title: "one" })] },
    ]);
    harness.emit(null, [
      { type: "updated", result: [detail("a", { title: "two" })] },
    ]);
    expect(harness.events).toEqual([]);

    vi.advanceTimersByTime(1000);
    expect(harness.events).toEqual([
      { event: "pr", data: detail("a", { title: "two" }) },
    ]);
  });

  it("skips a change of `updatedAt` alone", () => {
    const harness = openWith();
    snapshot(harness, [detail("a")]);
    harness.events.length = 0;

    harness.emit(null, [
      {
        type: "updated",
        result: [detail("a", { updatedAt: "2026-10-18T11:00:00.000Z" })],
      },
    ]);
    vi.advanceTimersByTime(1000);

    expect(harness.events).toEqual([]);
  });

  it("sends a pull request entering the scope", () => {
    const harness = openWith();
    snapshot(harness, []);
    harness.events.length = 0;

    harness.emit(null, [{ type: "inserted", result: [detail("c")] }]);
    vi.advanceTimersByTime(1000);

    expect(names(harness.events)).toEqual(["pr:c"]);
  });

  it("tells why a pull request left the scope", async () => {
    const harness = openWith({
      closed: storedPr("closed", true),
      unassigned: storedPr("unassigned", false),
    });
    snapshot(harness, [detail("closed"), detail("unassigned"), detail("gone")]);
    harness.events.length = 0;

    harness.emit(null, [
      { type: "deleted", keys: ["closed", "unassigned", "gone"] },
    ]);
    await vi.advanceTimersByTimeAsync(1000);

    expect(harness.events).toEqual([
      { event: "pr", data: detail("closed", { state: "closed" }) },
      { event: "prRemoved", data: { _id: "unassigned", reason: "outOfScope" } },
      { event: "prRemoved", data: { _id: "gone", reason: "deleted" } },
    ]);
  });

  it("does not remove a pull request the reader never got", async () => {
    const harness = openWith();
    snapshot(harness, []);
    harness.events.length = 0;

    harness.emit(null, [{ type: "deleted", keys: ["unknown"] }]);
    await vi.advanceTimersByTimeAsync(1000);

    expect(harness.events).toEqual([]);
  });

  it("keeps a change that arrives while a removal is read", async () => {
    let resolveRead: (pr: ReviewflowPr | undefined) => void = () => {};
    const harness = openWith();
    harness.readPr.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRead = resolve;
        }),
    );
    snapshot(harness, [detail("a")]);
    harness.events.length = 0;

    harness.emit(null, [{ type: "deleted", keys: ["a"] }]);
    harness.emit(null, [
      { type: "inserted", result: [detail("a", { title: "back" })] },
    ]);
    resolveRead(undefined);
    await vi.advanceTimersByTimeAsync(1000);

    expect(harness.events).toEqual([
      { event: "pr", data: detail("a", { title: "back" }) },
    ]);
  });

  it("ends with reset on a later whole result", () => {
    const harness = openWith();
    snapshot(harness, [detail("a")]);
    harness.events.length = 0;

    snapshot(harness, [detail("a")]);

    expect(harness.events).toEqual([
      { event: "reset", data: { reason: "resync" } },
    ]);
    expect(harness.stop).toHaveBeenCalled();
    expect(harness.end).toHaveBeenCalledOnce();
  });

  it("ends with reset on an error", () => {
    const harness = openWith();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    harness.emit(new Error("mongo is down"), []);

    expect(harness.events).toEqual([
      { event: "reset", data: { reason: "error" } },
    ]);
    expect(harness.end).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });
});

describe("parseClosedWithinDays", () => {
  it("defaults to 0 and accepts 0 to 30", () => {
    expect(parseClosedWithinDays(undefined)).toBe(0);
    expect(parseClosedWithinDays("0")).toBe(0);
    expect(parseClosedWithinDays("30")).toBe(30);
  });

  it("rejects anything else", () => {
    for (const value of ["31", "-1", "1.5", "7d", "007"]) {
      expect(() => parseClosedWithinDays(value)).toThrow(/closedWithinDays/);
    }
  });
});
