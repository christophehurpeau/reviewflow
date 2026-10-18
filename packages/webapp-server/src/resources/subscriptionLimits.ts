import type { ServiceResource } from "liwi-resources-server";
import type { Query, QuerySubscription, SubscribeCallback } from "liwi-store";
import { Logger } from "nightingale-logger";
import type { LiveUpdatesMeta, LiveUpdatesPausedBy } from "reviewflow-modules";

const logger = new Logger("reviewflow:webapp-server:subscriptionLimits");

/*
 * Every live subscription is refetched on each store relay (re)connection and
 * re-tested on every relayed write, synchronously. Measured in
 * `core/src/storeRelay.load.test.ts`: the event loop stalls about 100 ms past
 * 1400 board subscriptions on a laptop.
 */
const DEFAULT_MAX_LIVE_SUBSCRIPTIONS = 1000;
/** a board tab holds 9 subscriptions: about 5 tabs */
const DEFAULT_MAX_LIVE_SUBSCRIPTIONS_PER_USER = 45;

export interface SubscriptionLimits {
  maxTotal: number;
  maxPerUser: number;
}

const readPositiveInteger = (
  value: string | undefined,
  fallback: number,
): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const readSubscriptionLimits = (
  env: NodeJS.ProcessEnv = process.env,
): SubscriptionLimits => ({
  maxTotal: readPositiveInteger(
    env.MAX_LIVE_SUBSCRIPTIONS,
    DEFAULT_MAX_LIVE_SUBSCRIPTIONS,
  ),
  maxPerUser: readPositiveInteger(
    env.MAX_LIVE_SUBSCRIPTIONS_PER_USER,
    DEFAULT_MAX_LIVE_SUBSCRIPTIONS_PER_USER,
  ),
});

type ReleaseSlot = () => void;

export type AcquiredSlot =
  | { limitReached: LiveUpdatesPausedBy }
  | { release: ReleaseSlot };

export interface SubscriptionSlots {
  acquire: (userKey: string) => AcquiredSlot;
  getCounts: () => { total: number; users: number };
}

export const createSubscriptionSlots = ({
  maxTotal,
  maxPerUser,
}: SubscriptionLimits): SubscriptionSlots => {
  let total = 0;
  const countByUser = new Map<string, number>();

  return {
    acquire: (userKey) => {
      const userCount = countByUser.get(userKey) ?? 0;
      if (userCount >= maxPerUser) return { limitReached: "userLimit" };
      if (total >= maxTotal) return { limitReached: "serverLimit" };

      total++;
      countByUser.set(userKey, userCount + 1);
      let isReleased = false;
      return {
        release: () => {
          if (isReleased) return;
          isReleased = true;
          total--;
          const remaining = (countByUser.get(userKey) ?? 1) - 1;
          if (remaining === 0) countByUser.delete(userKey);
          else countByUser.set(userKey, remaining);
        },
      };
    },
    getCounts: () => ({ total, users: countByUser.size }),
  };
};

const noop = (): void => {};

const toSubscription = (
  promise: PromiseLike<unknown>,
  stop: () => void,
): QuerySubscription => ({
  stop,
  cancel: stop,
  then: (onFulfilled, onRejected) =>
    promise.then(() => undefined).then(onFulfilled, onRejected),
});

const withLiveUpdates = <Meta extends object>(
  meta: Meta,
  liveUpdates: LiveUpdatesMeta,
): LiveUpdatesMeta & Meta => ({ ...meta, ...liveUpdates });

/** the degraded mode: the result as of now, no live update */
const fetchOnce = (
  query: Query<any, any>,
  callback: SubscribeCallback<any, any>,
  pausedBy: LiveUpdatesPausedBy,
): QuerySubscription =>
  toSubscription(
    query.fetch(({ result, meta, info }) => {
      callback(null, [
        {
          type: "initial",
          initial: result,
          meta: withLiveUpdates(meta, {
            liveUpdates: "paused",
            liveUpdatesPausedBy: pausedBy,
          }),
          queryInfo: info,
        },
      ]);
    }),
    noop,
  );

const withSlot = (
  subscribe: (callback: SubscribeCallback<any, any>) => QuerySubscription,
  callback: SubscribeCallback<any, any>,
  releaseSlot: ReleaseSlot,
): QuerySubscription => {
  const subscription = subscribe((err, changes) =>
    callback(
      err,
      changes?.map((change) =>
        change.type === "initial"
          ? {
              ...change,
              meta: withLiveUpdates(change.meta, { liveUpdates: "live" }),
            }
          : change,
      ),
    ),
  );
  return toSubscription(subscription, () => {
    releaseSlot();
    subscription.stop();
  });
};

export const limitQuerySubscriptions = (
  query: Query<any, any>,
  acquireSlot: () => AcquiredSlot,
  onLimitReached: (limitReached: LiveUpdatesPausedBy) => void,
): Query<any, any> => ({
  changeParams: (params) => {
    query.changeParams(params);
  },
  changePartialParams: (params) => {
    query.changePartialParams(params);
  },
  fetch: (onFulfilled) => query.fetch(onFulfilled),
  fetchAndSubscribe: (callback) => {
    const slot = acquireSlot();
    if ("limitReached" in slot) {
      onLimitReached(slot.limitReached);
      return fetchOnce(query, callback, slot.limitReached);
    }
    return withSlot(
      (subscriptionCallback) => query.fetchAndSubscribe(subscriptionCallback),
      callback,
      slot.release,
    );
  },
  subscribe: (callback) => {
    const slot = acquireSlot();
    if ("limitReached" in slot) {
      onLimitReached(slot.limitReached);
      return toSubscription(Promise.resolve(), noop);
    }
    return withSlot(
      (subscriptionCallback) => query.subscribe(subscriptionCallback),
      callback,
      slot.release,
    );
  },
});

/**
 * Past the limits, a subscription degrades to a single fetch: the screen shows
 * the data as of its opening and refreshes on its next load, while the live
 * subscriptions of everyone else stay within what the process can refetch.
 */
export const withSubscriptionLimits = <
  Resource extends ServiceResource<any, any>,
>(
  resource: Resource,
  slots: SubscriptionSlots,
): Resource => ({
  ...resource,
  queries: Object.fromEntries(
    Object.entries(resource.queries).map(([key, createQuery]) => [
      key,
      async (params: unknown, loggedInUser: { id: number } | undefined) => {
        const query = (await createQuery(params, loggedInUser)) as Query<
          any,
          any
        >;
        const userKey = String(loggedInUser?.id ?? "anonymous");
        return limitQuerySubscriptions(
          query,
          () => slots.acquire(userKey),
          (limitReached) => {
            logger.warn("Live subscription limit reached, fetch only", {
              query: key,
              userKey,
              limitReached,
              ...slots.getCounts(),
            });
          },
        );
      },
    ]),
  ),
});
