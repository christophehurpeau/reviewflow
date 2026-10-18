import type { MongoStores } from "reviewflow-core";
import { findEnabledAccountIds, isPaidEnabled } from "reviewflow-core";

export interface PaidAccounts {
  /** which of the accounts the admin enabled */
  findEnabled: (accountIds: readonly number[]) => Promise<Set<number>>;
  /**
   * `onChange` runs when the flag of one of the accounts `getAccountIds`
   * returns at that moment may have changed, whoever wrote it, and after a
   * resync. Nothing else (the bot's syncs rewrite accounts all the time) wakes it.
   */
  watch: (
    getAccountIds: () => readonly number[],
    onChange: () => void,
  ) => () => void;
}

type PaidStores = Pick<MongoStores, "orgs" | "users">;
type AccountsAction =
  | Parameters<Parameters<PaidStores["orgs"]["subscribe"]>[0]>[0]
  | Parameters<Parameters<PaidStores["users"]["subscribe"]>[0]>[0];

const getFlagChangedIds = (
  action: AccountsAction,
): ReadonlySet<number> | "all" => {
  switch (action.type) {
    case "inserted":
      return new Set(action.next.map(({ _id }) => _id));
    case "deleted":
      return new Set(action.prev.map(({ _id }) => _id));
    case "updated":
      return new Set(
        action.changes
          .filter(([prev, next]) => isPaidEnabled(prev) !== isPaidEnabled(next))
          .map(([, next]) => next._id),
      );
    case "changed":
      return new Set([
        ...action.keys.map(Number),
        ...action.next.map(({ _id }) => _id),
      ]);
    case "resync":
    default:
      return "all";
  }
};

/**
 * One listener per store, attached while something watches: a liwi
 * subscription cannot change its criteria, so each gated one re-reads the flag
 * from here.
 */
export const createPaidAccounts = (stores: PaidStores): PaidAccounts => {
  const watchers = new Set<{
    getAccountIds: () => readonly number[];
    onChange: () => void;
  }>();
  let unsubscribes: (() => void)[] = [];

  const onAction = (action: AccountsAction): void => {
    const changed = getFlagChangedIds(action);
    if (changed !== "all" && changed.size === 0) return;
    for (const { getAccountIds, onChange } of watchers) {
      if (changed === "all" || getAccountIds().some((id) => changed.has(id))) {
        onChange();
      }
    }
  };

  return {
    findEnabled: (accountIds) => findEnabledAccountIds(stores, accountIds),
    watch: (getAccountIds, onChange) => {
      const watcher = { getAccountIds, onChange };
      watchers.add(watcher);
      if (unsubscribes.length === 0) {
        unsubscribes = [
          stores.orgs.subscribe(onAction),
          stores.users.subscribe(onAction),
        ];
      }

      return () => {
        watchers.delete(watcher);
        if (watchers.size === 0) {
          unsubscribes.forEach((unsubscribe) => {
            unsubscribe();
          });
          unsubscribes = [];
        }
      };
    },
  };
};
