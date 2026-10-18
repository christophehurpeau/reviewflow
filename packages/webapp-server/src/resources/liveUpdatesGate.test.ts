import { describe, expect, it, vi } from "vitest";
import type { ServiceResource } from "liwi-resources-server";
import type { Change, Query, QueryResult, SubscribeCallback } from "liwi-store";
import type { AuthenticatedWsUser } from "./getAuthenticatedUser.ts";
import {
  gateQueryLiveUpdates,
  withLiveUpdatesGate,
} from "./liveUpdatesGate.ts";
import type { MembershipScopes } from "./membershipScopes.ts";
import type { PaidAccounts } from "./paidAccounts.ts";
import { createPaidAccounts } from "./paidAccounts.ts";
import {
  createSubscriptionSlots,
  withSubscriptionLimits,
} from "./subscriptionLimits.ts";

const user: AuthenticatedWsUser = {
  id: 42,
  login: "jane-doe",
  accessToken: "token",
};

const queryResult: QueryResult<{ _id: string }[]> = {
  result: [{ _id: "pr-1" }],
  meta: { total: 1 },
  info: { keyPath: "_id" },
};

interface FakeQuery extends Query<any, any> {
  liveStarts: number;
  stops: number;
}

const createFakeQuery = (): FakeQuery => {
  const query: FakeQuery = {
    liveStarts: 0,
    stops: 0,
    changeParams: vi.fn(),
    changePartialParams: vi.fn(),
    fetch: (onFulfilled) => Promise.resolve(onFulfilled(queryResult)),
    fetchAndSubscribe: (callback) => {
      query.liveStarts++;
      callback(null, [
        {
          type: "initial",
          initial: queryResult.result,
          meta: { ...queryResult.meta, liveUpdates: "live" } as any,
          queryInfo: queryResult.info,
        },
      ]);
      const stop = (): void => {
        query.stops++;
      };
      return {
        stop,
        cancel: stop,
        then: (onFulfilled) => Promise.resolve().then(onFulfilled),
      };
    },
    subscribe: (callback) => query.fetchAndSubscribe(callback),
  };
  return query;
};

interface FakePaid extends PaidAccounts {
  enabled: Set<number>;
  /** a flag changed: wakes the watchers */
  notify: () => void;
  unwatched: number;
}

const createFakePaid = (enabled: number[]): FakePaid => {
  const watchers = new Set<() => void>();
  const paid: FakePaid = {
    enabled: new Set(enabled),
    unwatched: 0,
    notify: () => {
      watchers.forEach((onChange) => {
        onChange();
      });
    },
    findEnabled: (ids) =>
      Promise.resolve(new Set(ids.filter((id) => paid.enabled.has(id)))),
    watch: (getAccountIds, onChange) => {
      watchers.add(onChange);
      return () => {
        paid.unwatched++;
        watchers.delete(onChange);
      };
    },
  };
  return paid;
};

const scopes: MembershipScopes = { watch: () => () => {} };

const collect = () => {
  const changes: Change<any, any>[] = [];
  const callback: SubscribeCallback<any, any> = (error, received) => {
    if (error) throw error;
    changes.push(...received);
  };
  return { changes, callback };
};

const metaOf = (change: Change<any, any> | undefined): unknown =>
  change?.type === "initial" ? change.meta : undefined;

const open = (paid: PaidAccounts, query: Query<any, any>, ids: number[]) =>
  gateQueryLiveUpdates(query, {
    paid,
    scopes,
    user,
    getAccountIds: () => Promise.resolve(ids),
  });

describe("gateQueryLiveUpdates", () => {
  it("subscribes live to an enabled account", async () => {
    const query = createFakeQuery();
    const { changes, callback } = collect();

    await open(createFakePaid([1]), query, [1]).fetchAndSubscribe(callback);

    expect(query.liveStarts).toBe(1);
    expect(metaOf(changes[0])).toMatchObject({ liveUpdates: "live" });
  });

  it("degrades to a single fetch for an account that is not enabled", async () => {
    const query = createFakeQuery();
    const { changes, callback } = collect();

    await open(createFakePaid([]), query, [1]).fetchAndSubscribe(callback);

    expect(query.liveStarts).toBe(0);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      type: "initial",
      initial: queryResult.result,
    });
    expect(metaOf(changes[0])).toMatchObject({
      total: 1,
      liveUpdates: "paused",
      liveUpdatesPausedBy: "notEnabled",
    });
  });

  it("is live as soon as one of several accounts is enabled", async () => {
    const live = createFakeQuery();
    await open(createFakePaid([2]), live, [1, 2, 3]).fetchAndSubscribe(
      collect().callback,
    );
    expect(live.liveStarts).toBe(1);

    const paused = createFakeQuery();
    await open(createFakePaid([9]), paused, [1, 2, 3]).fetchAndSubscribe(
      collect().callback,
    );
    expect(paused.liveStarts).toBe(0);
  });

  it("is paused when the query spans no account", async () => {
    const query = createFakeQuery();
    await open(createFakePaid([1]), query, []).fetchAndSubscribe(
      collect().callback,
    );
    expect(query.liveStarts).toBe(0);
  });

  it("sends nothing for a `subscribe` on an account that is not enabled", async () => {
    const query = createFakeQuery();
    const { changes, callback } = collect();

    await open(createFakePaid([]), query, [1]).subscribe(callback);

    expect(changes).toHaveLength(0);
    expect(query.liveStarts).toBe(0);
  });

  it("degrades a live subscription when its account is disabled", async () => {
    const paid = createFakePaid([1]);
    const query = createFakeQuery();
    const { changes, callback } = collect();
    await open(paid, query, [1]).fetchAndSubscribe(callback);

    paid.enabled.delete(1);
    paid.notify();
    await vi.waitFor(() => {
      expect(changes).toHaveLength(2);
    });

    expect(query.stops).toBe(1);
    expect(metaOf(changes[1])).toMatchObject({
      liveUpdates: "paused",
      liveUpdatesPausedBy: "notEnabled",
    });
  });

  it("goes live when its account is enabled", async () => {
    const paid = createFakePaid([]);
    const query = createFakeQuery();
    const { changes, callback } = collect();
    await open(paid, query, [1]).fetchAndSubscribe(callback);

    paid.enabled.add(1);
    paid.notify();
    await vi.waitFor(() => {
      expect(query.liveStarts).toBe(1);
    });

    expect(metaOf(changes[1])).toMatchObject({ liveUpdates: "live" });
  });

  it("does not resend anything when the decision did not change", async () => {
    const paid = createFakePaid([1]);
    const query = createFakeQuery();
    const { changes, callback } = collect();
    await open(paid, query, [1]).fetchAndSubscribe(callback);

    paid.notify();
    await new Promise((resolve) => {
      setTimeout(resolve, 10);
    });

    expect(changes).toHaveLength(1);
    expect(query.liveStarts).toBe(1);
  });

  it("stops the inner subscription and the watchers", async () => {
    const paid = createFakePaid([1]);
    const query = createFakeQuery();
    const subscription = open(paid, query, [1]).fetchAndSubscribe(
      collect().callback,
    );
    await subscription;

    subscription.stop();
    paid.enabled.delete(1);
    paid.notify();

    expect(query.stops).toBe(1);
    expect(paid.unwatched).toBe(1);
  });
});

type CreateQuery = (
  params: unknown,
  user: AuthenticatedWsUser,
) => Promise<Query<any, any>>;

const queriesOf = (
  resource: ServiceResource<any, AuthenticatedWsUser>,
): Record<"free" | "gated", CreateQuery> =>
  resource.queries as unknown as Record<"free" | "gated", CreateQuery>;

describe("withLiveUpdatesGate", () => {
  const createResource = (query: Query<any, any>) =>
    ({
      queries: {
        gated: vi.fn(() => Promise.resolve(query)),
        free: vi.fn(() => Promise.resolve(query)),
      },
      operations: {},
    }) as unknown as ServiceResource<any, AuthenticatedWsUser>;

  it("gates the declared queries only", async () => {
    const query = createFakeQuery();
    const resource = createResource(query);
    const gated = withLiveUpdatesGate(resource, {
      paid: createFakePaid([]),
      scopes,
      spans: { gated: () => Promise.resolve([1]) },
    });

    const free = await queriesOf(gated).free({}, user);
    expect(free).toBe(query);

    const callback = collect();
    const gatedQuery = await queriesOf(gated).gated({}, user);
    await gatedQuery.fetchAndSubscribe(callback.callback);
    expect(query.liveStarts).toBe(0);
    expect(metaOf(callback.changes[0])).toMatchObject({
      liveUpdatesPausedBy: "notEnabled",
    });
  });

  it("lets the query refuse before the flag is read", async () => {
    const resource: ServiceResource<any, AuthenticatedWsUser> = {
      queries: {
        gated: () => Promise.reject(new Error("FORBIDDEN")),
      },
      operations: {},
    };
    const spans = vi.fn(() => Promise.resolve([1]));
    const gated = withLiveUpdatesGate(resource, {
      paid: createFakePaid([1]),
      scopes,
      spans: { gated: spans },
    });

    await expect(queriesOf(gated).gated({}, user)).rejects.toThrow("FORBIDDEN");
    expect(spans).not.toHaveBeenCalled();
  });

  it("reads a lost membership as no enabled account", async () => {
    const { ResourcesServerError } = await import("liwi-resources-server");
    const query = createFakeQuery();
    const gated = withLiveUpdatesGate(createResource(query), {
      paid: createFakePaid([1]),
      scopes,
      spans: {
        gated: () =>
          Promise.reject(new ResourcesServerError("FORBIDDEN", "not a member")),
      },
    });

    const gatedQuery = await queriesOf(gated).gated({}, user);
    await gatedQuery.fetchAndSubscribe(collect().callback);
    expect(query.liveStarts).toBe(0);
  });
});

describe("the gate over the subscription limits", () => {
  const build = (enabled: number[]) => {
    const query = createFakeQuery();
    const slots = createSubscriptionSlots({ maxTotal: 10, maxPerUser: 10 });
    const resource: ServiceResource<any, AuthenticatedWsUser> = {
      queries: { gated: () => Promise.resolve(query) },
      operations: {},
    };
    const gated = withLiveUpdatesGate(withSubscriptionLimits(resource, slots), {
      paid: createFakePaid(enabled),
      scopes,
      spans: { gated: () => Promise.resolve([1]) },
    });
    return { gated, slots };
  };

  it("takes a slot and stamps `live` for an enabled account", async () => {
    const { gated, slots } = build([1]);
    const { changes, callback } = collect();

    const query = await queriesOf(gated).gated({}, user);
    await query.fetchAndSubscribe(callback);

    expect(metaOf(changes[0])).toMatchObject({ liveUpdates: "live" });
    expect(slots.getCounts().total).toBe(1);
  });

  it("takes no slot and keeps `notEnabled` for an account that is not enabled", async () => {
    const { gated, slots } = build([]);
    const { changes, callback } = collect();

    const query = await queriesOf(gated).gated({}, user);
    await query.fetchAndSubscribe(callback);

    expect(metaOf(changes[0])).toMatchObject({
      liveUpdates: "paused",
      liveUpdatesPausedBy: "notEnabled",
    });
    expect(slots.getCounts().total).toBe(0);
  });
});

describe("createPaidAccounts", () => {
  type Listener = (action: unknown) => void;

  const createStores = () => {
    const listeners: { orgs: Listener[]; users: Listener[] } = {
      orgs: [],
      users: [],
    };
    const subscribe = (key: "orgs" | "users") => (listener: Listener) => {
      listeners[key].push(listener);
      return () => {
        listeners[key] = listeners[key].filter((item) => item !== listener);
      };
    };
    const stores = {
      orgs: { subscribe: subscribe("orgs") },
      users: { subscribe: subscribe("users") },
    } as any;
    return { stores, listeners };
  };

  const org = (_id: number, enabled?: boolean) => ({
    _id,
    paidFeatures: enabled === undefined ? undefined : { enabled },
  });

  it("wakes a watcher when the flag of a spanned account changes", () => {
    const { stores, listeners } = createStores();
    const onChange = vi.fn();
    createPaidAccounts(stores).watch(() => [1, 2], onChange);

    listeners.orgs[0]!({
      type: "updated",
      changes: [[org(2, false), org(2, true)]],
    });
    expect(onChange).toHaveBeenCalledTimes(1);

    listeners.users[0]!({
      type: "updated",
      changes: [[org(1), org(1, true)]],
    });
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("ignores other accounts and writes that leave the flag alone", () => {
    const { stores, listeners } = createStores();
    const onChange = vi.fn();
    createPaidAccounts(stores).watch(() => [1], onChange);

    listeners.orgs[0]!({
      type: "updated",
      changes: [[org(2, false), org(2, true)]],
    });
    listeners.orgs[0]!({
      type: "updated",
      changes: [[org(1, true), org(1, true)]],
    });
    listeners.orgs[0]!({ type: "updated", changes: [[org(1), org(1, false)]] });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("wakes on a relayed write only when the flag was not seen yet or differs", () => {
    const { stores, listeners } = createStores();
    const onChange = vi.fn();
    createPaidAccounts(stores).watch(() => [1], onChange);
    const relay = (next: ReturnType<typeof org>[]): void => {
      listeners.orgs[0]!({ type: "changed", keys: [1], next });
    };

    relay([org(1, true)]);
    expect(onChange).toHaveBeenCalledTimes(1);

    relay([org(1, true)]);
    expect(onChange).toHaveBeenCalledTimes(1);

    relay([org(1, false)]);
    expect(onChange).toHaveBeenCalledTimes(2);

    relay([]);
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it("compares a relayed write with the flag of a local write", () => {
    const { stores, listeners } = createStores();
    const onChange = vi.fn();
    createPaidAccounts(stores).watch(() => [1], onChange);

    listeners.orgs[0]!({ type: "updated", changes: [[org(1), org(1, true)]] });
    listeners.orgs[0]!({ type: "changed", keys: [1], next: [org(1, true)] });

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("forgets the seen flags on a resync and once detached", () => {
    const { stores, listeners } = createStores();
    const onChange = vi.fn();
    const paidAccounts = createPaidAccounts(stores);
    const unwatch = paidAccounts.watch(() => [1], onChange);
    const relayEnabled = (): void => {
      listeners.orgs[0]!({ type: "changed", keys: [1], next: [org(1, true)] });
    };

    relayEnabled();
    listeners.orgs[0]!({ type: "resync" });
    relayEnabled();
    expect(onChange).toHaveBeenCalledTimes(3);

    unwatch();
    paidAccounts.watch(() => [1], onChange);
    relayEnabled();
    expect(onChange).toHaveBeenCalledTimes(4);
  });

  it("wakes every watcher on a resync, and detaches once none is left", () => {
    const { stores, listeners } = createStores();
    const onChange = vi.fn();
    const unwatch = createPaidAccounts(stores).watch(() => [1], onChange);

    listeners.users[0]!({ type: "resync" });
    expect(onChange).toHaveBeenCalledTimes(1);

    unwatch();
    expect(listeners.orgs).toHaveLength(0);
    expect(listeners.users).toHaveLength(0);
  });
});
