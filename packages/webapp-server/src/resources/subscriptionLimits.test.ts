import { describe, expect, it, vi } from "vitest";
import type { Change, Query, QueryResult, SubscribeCallback } from "liwi-store";
import {
  createSubscriptionSlots,
  limitQuerySubscriptions,
  readSubscriptionLimits,
} from "./subscriptionLimits.ts";

const queryResult: QueryResult<{ _id: string }[]> = {
  result: [{ _id: "pr-1" }],
  meta: { total: 1 },
  info: { keyPath: "_id" },
};

interface FakeQuery extends Query<{ _id: string }[], Record<string, never>> {
  liveCallbacks: SubscribeCallback<string, { _id: string }[]>[];
  stopped: number;
}

const createFakeQuery = (): FakeQuery => {
  const query: FakeQuery = {
    liveCallbacks: [],
    stopped: 0,
    changeParams: vi.fn(),
    changePartialParams: vi.fn(),
    fetch: (onFulfilled) => Promise.resolve(onFulfilled(queryResult)),
    fetchAndSubscribe: (callback) => {
      query.liveCallbacks.push(callback);
      callback(null, [
        {
          type: "initial",
          initial: queryResult.result,
          meta: queryResult.meta,
          queryInfo: queryResult.info,
        },
      ]);
      const stop = (): void => {
        query.stopped++;
      };
      return {
        stop,
        cancel: stop,
        then: (onFulfilled, onRejected) =>
          Promise.resolve().then(onFulfilled, onRejected),
      };
    },
    subscribe: (callback) => query.fetchAndSubscribe(callback),
  };
  return query;
};

describe("limitQuerySubscriptions", () => {
  it("subscribes live within the limits, and frees the slot on stop", async () => {
    const slots = createSubscriptionSlots({ maxTotal: 2, maxPerUser: 2 });
    const query = createFakeQuery();
    const onLimitReached = vi.fn();
    const limited = limitQuerySubscriptions(
      query,
      () => slots.acquire("42"),
      onLimitReached,
    );

    const subscription = limited.fetchAndSubscribe(vi.fn());
    await subscription;
    expect(query.liveCallbacks).toHaveLength(1);
    expect(slots.getCounts()).toEqual({ total: 1, users: 1 });

    subscription.stop();
    subscription.stop();
    expect(query.stopped).toBe(2);
    expect(slots.getCounts()).toEqual({ total: 0, users: 0 });
    expect(onLimitReached).not.toHaveBeenCalled();
  });

  it("marks the initial change live within the limits, and leaves later changes as they are", async () => {
    const slots = createSubscriptionSlots({ maxTotal: 2, maxPerUser: 2 });
    const query = createFakeQuery();
    const limited = limitQuerySubscriptions(
      query,
      () => slots.acquire("42"),
      vi.fn(),
    );
    const callback = vi.fn();

    await limited.fetchAndSubscribe(callback);
    const inserted: Change<string, { _id: string }[]> = {
      type: "inserted",
      result: [{ _id: "pr-2" }],
    };
    query.liveCallbacks[0]?.(null, [inserted]);

    expect(callback).toHaveBeenNthCalledWith(1, null, [
      {
        type: "initial",
        initial: queryResult.result,
        meta: { ...queryResult.meta, liveUpdates: "live" },
        queryInfo: queryResult.info,
      },
    ]);
    expect(callback).toHaveBeenNthCalledWith(2, null, [inserted]);
  });

  it("degrades to one fetch past the per user limit, leaving other users live", async () => {
    const slots = createSubscriptionSlots({ maxTotal: 10, maxPerUser: 1 });
    const query = createFakeQuery();
    const onLimitReached = vi.fn();
    const limitedFor = (userKey: string): Query<any, any> =>
      limitQuerySubscriptions(
        query,
        () => slots.acquire(userKey),
        onLimitReached,
      );

    await limitedFor("42").fetchAndSubscribe(vi.fn());
    const callback = vi.fn();
    await limitedFor("42").fetchAndSubscribe(callback);
    await limitedFor("43").fetchAndSubscribe(vi.fn());

    expect(callback).toHaveBeenCalledExactlyOnceWith(null, [
      {
        type: "initial",
        initial: queryResult.result,
        meta: {
          ...queryResult.meta,
          liveUpdates: "paused",
          liveUpdatesPausedBy: "userLimit",
        },
        queryInfo: queryResult.info,
      },
    ]);
    expect(query.liveCallbacks).toHaveLength(2);
    expect(onLimitReached).toHaveBeenCalledExactlyOnceWith("userLimit");
    expect(slots.getCounts()).toEqual({ total: 2, users: 2 });
  });

  it("degrades past the total limit, and subscribes live again once a slot is free", async () => {
    const slots = createSubscriptionSlots({ maxTotal: 1, maxPerUser: 10 });
    const query = createFakeQuery();
    const onLimitReached = vi.fn();
    const limitedFor = (userKey: string): Query<any, any> =>
      limitQuerySubscriptions(
        query,
        () => slots.acquire(userKey),
        onLimitReached,
      );

    const first = limitedFor("42").fetchAndSubscribe(vi.fn());
    await limitedFor("43").subscribe(vi.fn());
    expect(query.liveCallbacks).toHaveLength(1);
    expect(onLimitReached).toHaveBeenCalledExactlyOnceWith("serverLimit");

    first.stop();
    await limitedFor("43").subscribe(vi.fn());
    expect(query.liveCallbacks).toHaveLength(2);
  });
});

describe("readSubscriptionLimits", () => {
  it("reads positive integers and falls back on anything else", () => {
    expect(
      readSubscriptionLimits({
        MAX_LIVE_SUBSCRIPTIONS: "200",
        MAX_LIVE_SUBSCRIPTIONS_PER_USER: "0",
      }),
    ).toEqual({ maxTotal: 200, maxPerUser: 45 });
    expect(readSubscriptionLimits({})).toEqual({
      maxTotal: 1000,
      maxPerUser: 45,
    });
  });
});
