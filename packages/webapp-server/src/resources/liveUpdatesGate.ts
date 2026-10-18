import { ResourcesServerError } from "liwi-resources-server";
import type { ServiceResource } from "liwi-resources-server";
import type { Query, QuerySubscription, SubscribeCallback } from "liwi-store";
import { isLiveForAccounts } from "reviewflow-core";
import type { AuthenticatedWsUser } from "./getAuthenticatedUser.ts";
import type { MembershipScopes } from "./membershipScopes.ts";
import type { PaidAccounts } from "./paidAccounts.ts";
import { fetchOnce, noop, toSubscription } from "./subscriptionLimits.ts";

/** the accounts whose data a query reads, which decide whether it is live */
export type SpannedAccounts = (
  params: any,
  user: AuthenticatedWsUser,
) => Promise<readonly number[]>;

export interface LiveUpdatesGateOptions {
  paid: PaidAccounts;
  scopes: MembershipScopes;
  user: AuthenticatedWsUser;
  getAccountIds: () => Promise<readonly number[]>;
}

/** a membership lost: the query reads no account, so nothing enables it */
export const noAccountIfForbidden = async (
  resolve: () => Promise<readonly number[]>,
): Promise<readonly number[]> => {
  try {
    return await resolve();
  } catch (error) {
    if (error instanceof ResourcesServerError && error.code === "FORBIDDEN") {
      return [];
    }
    throw error;
  }
};

/**
 * Live updates are live for the accounts the admin enabled, a single fetch
 * (`notEnabled`) for the others. The decision is taken at subscription and
 * again when the flag of a spanned account, or the user's memberships, change:
 * the subscription then swaps its inner subscription, which sends its whole
 * result as an `initial` carrying the new `liveUpdates` meta.
 *
 * Wrapped outside `withSubscriptionLimits`, so a disabled query takes no slot
 * and a live one is stamped `live` by it.
 */
export const gateQueryLiveUpdates = (
  query: Query<any, any>,
  { paid, scopes, user, getAccountIds }: LiveUpdatesGateOptions,
): Query<any, any> => {
  const open = (
    callback: SubscribeCallback<any, any>,
    mode: "fetchAndSubscribe" | "subscribe",
  ): QuerySubscription => {
    let current: QuerySubscription | undefined;
    let isLive: boolean | undefined;
    let accountIds: readonly number[] = [];
    let latestEvaluation = 0;
    let isStopped = false;

    const evaluate = async (isFirst: boolean): Promise<void> => {
      const evaluation = ++latestEvaluation;
      const ids = await getAccountIds();
      if (isStopped || evaluation !== latestEvaluation) return;
      // before the lookup below: a flag changing meanwhile must wake this watcher
      accountIds = ids;
      const isEnabled = isLiveForAccounts(ids, await paid.findEnabled(ids));
      if (isStopped || evaluation !== latestEvaluation) return;
      if (isEnabled === isLive) return;

      isLive = isEnabled;
      current?.stop();
      if (isEnabled) {
        current = isFirst
          ? query[mode](callback)
          : query.fetchAndSubscribe(callback);
      } else if (isFirst && mode === "subscribe") {
        current = toSubscription(Promise.resolve(), noop);
      } else {
        current = fetchOnce(query, callback, "notEnabled");
      }
      await current;
    };

    const reevaluate = (): void => {
      evaluate(false).catch((error: unknown) => {
        if (!isStopped) callback(error as Error, []);
      });
    };

    const unwatchPaid = paid.watch(() => accountIds, reevaluate);
    const unwatchScopes = scopes.watch(user, reevaluate);

    const first = evaluate(true);
    // the failure reaches the caller through the subscription, once
    first.catch(noop);

    return toSubscription(first, () => {
      isStopped = true;
      unwatchPaid();
      unwatchScopes();
      current?.stop();
    });
  };

  return {
    changeParams: (params) => {
      query.changeParams(params);
    },
    changePartialParams: (params) => {
      query.changePartialParams(params);
    },
    fetch: (onFulfilled) => query.fetch(onFulfilled),
    fetchAndSubscribe: (callback) => open(callback, "fetchAndSubscribe"),
    subscribe: (callback) => open(callback, "subscribe"),
  };
};

/** `spans` lists the gated queries by name: the others stay live whoever's they are */
export const withLiveUpdatesGate = <Resource extends ServiceResource<any, any>>(
  resource: Resource,
  {
    paid,
    scopes,
    spans,
  }: {
    paid: PaidAccounts;
    scopes: MembershipScopes;
    spans: Record<string, SpannedAccounts>;
  },
): Resource => ({
  ...resource,
  queries: Object.fromEntries(
    Object.entries(resource.queries).map(([key, createQuery]) => {
      const spanned = spans[key];
      if (!spanned) return [key, createQuery];

      return [
        key,
        async (
          params: unknown,
          loggedInUser: AuthenticatedWsUser | undefined,
        ) => {
          // authorization first: the inner query refuses what the user may not read
          const query = (await createQuery(params, loggedInUser)) as Query<
            any,
            any
          >;
          if (!loggedInUser) return query;
          return gateQueryLiveUpdates(query, {
            paid,
            scopes,
            user: loggedInUser,
            getAccountIds: () =>
              noAccountIfForbidden(() => spanned(params, loggedInUser)),
          });
        },
      ];
    }),
  ),
});
