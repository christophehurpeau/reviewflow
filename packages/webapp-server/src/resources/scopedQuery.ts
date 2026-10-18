import { ResourcesServerError } from "liwi-resources-server";
import type { Query, QuerySubscription, SubscribeCallback } from "liwi-store";
import type { AuthenticatedWsUser } from "./getAuthenticatedUser.ts";
import type { MembershipScopes } from "./membershipScopes.ts";

/** criteria no document matches: what a query selects once its scope is lost */
export const matchNothing: any = { _id: { $in: [] } };

/** `undefined`: the user is not (any more) a member, so nothing is in scope */
export const toScopeOrUndefined = async <Scope>(
  resolve: () => Promise<Scope>,
): Promise<Scope | undefined> => {
  try {
    return await resolve();
  } catch (error) {
    if (error instanceof ResourcesServerError && error.code === "FORBIDDEN") {
      return undefined;
    }
    throw error;
  }
};

export interface ScopedQueryOptions<Scope> {
  user: AuthenticatedWsUser;
  scopes: MembershipScopes;
  /** the scope `createQuery` is first given */
  initialScope: Scope | undefined;
  resolveScope: () => Promise<Scope | undefined>;
  /** `undefined`: a query selecting nothing */
  createQuery: (scope: Scope | undefined) => Query<any, any>;
}

const toSubscription = (
  promise: PromiseLike<unknown>,
  stop: () => void,
): QuerySubscription => ({
  stop,
  cancel: stop,
  then: (onFulfilled, onRejected) =>
    promise.then(() => undefined).then(onFulfilled, onRejected),
});

/**
 * A query whose criteria derive from the user's memberships. A subscription
 * follows them: once they change it swaps its inner subscription for one on the
 * new scope, which sends its whole result as an `initial`. A scope lost leaves a
 * subscription on a query selecting nothing, so the client drops the rows and
 * gets them back with the membership.
 *
 * The swap happens inside the query, so a slot held around it by
 * `withSubscriptionLimits` is neither released nor taken again.
 */
export const createScopedQuery = <Scope>({
  user,
  scopes,
  initialScope,
  resolveScope,
  createQuery,
}: ScopedQueryOptions<Scope>): Query<any, any> => {
  const initialQuery = createQuery(initialScope);
  const serialize = (scope: Scope | undefined): string =>
    JSON.stringify(scope ?? null);

  const open = (
    callback: SubscribeCallback<any, any>,
    mode: "fetchAndSubscribe" | "subscribe",
  ): QuerySubscription => {
    const first = initialQuery[mode](callback);
    let inner = first;
    let scopeKey = serialize(initialScope);
    let latestRefresh = 0;
    let isStopped = false;

    const refresh = async (): Promise<void> => {
      const refreshId = ++latestRefresh;
      let scope: Scope | undefined;
      try {
        scope = await resolveScope();
      } catch (error) {
        if (!isStopped && refreshId === latestRefresh) {
          callback(error as Error, []);
        }
        return;
      }
      if (isStopped || refreshId !== latestRefresh) return;

      const nextKey = serialize(scope);
      if (nextKey === scopeKey) return;
      scopeKey = nextKey;
      inner.stop();
      inner = createQuery(scope).fetchAndSubscribe(callback);
    };

    const unwatch = scopes.watch(user, () => {
      refresh().catch((error: unknown) => {
        console.error("Could not refresh the scope of a subscription", error);
      });
    });

    return toSubscription(first, () => {
      isStopped = true;
      unwatch();
      inner.stop();
    });
  };

  return {
    changeParams: (params) => {
      initialQuery.changeParams(params);
    },
    changePartialParams: (params) => {
      initialQuery.changePartialParams(params);
    },
    fetch: (onFulfilled) => initialQuery.fetch(onFulfilled),
    fetchAndSubscribe: (callback) => open(callback, "fetchAndSubscribe"),
    subscribe: (callback) => open(callback, "subscribe"),
  };
};
