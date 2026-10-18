import type { MongoStores } from "reviewflow-core";
import { findEnabledAccountIds, isPaidEnabled } from "reviewflow-core";

export interface PaidAccounts {
  /** which of the accounts the admin enabled */
  findEnabled: (accountIds: readonly number[]) => Promise<Set<number>>;
  /**
   * `onChange` runs when the flag of one of the accounts `getAccountIds`
   * returns at that moment may have changed, whoever wrote it, and after a
   * resync. Nothing else (the bot's syncs rewrite accounts all the time) wakes
   * it: a write relayed from the bot carries no previous document, so it wakes
   * it only for an account whose flag was not seen yet or differs.
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
type Account = Parameters<typeof isPaidEnabled>[0] & { _id: number };

const idsOf = (accounts: readonly Account[]): number[] =>
  accounts.map(({ _id }) => _id);

/**
 * Filled from the actions only, never from reads: a read resolving after a
 * newer action would record a stale flag and hide the next change.
 */
const createSeenFlags = () => {
  const seen = new Map<number, boolean>();

  const recordFlagChanged = (account: Account): boolean => {
    const enabled = isPaidEnabled(account);
    const isChanged = seen.get(account._id) !== enabled;
    seen.set(account._id, enabled);
    return isChanged;
  };

  const getFlagChangedIds = (
    action: AccountsAction,
  ): ReadonlySet<number> | "all" => {
    switch (action.type) {
      case "inserted":
        action.next.forEach(recordFlagChanged);
        return new Set(idsOf(action.next));
      case "deleted":
        idsOf(action.prev).forEach((id) => seen.delete(id));
        return new Set(idsOf(action.prev));
      case "updated":
        action.changes.forEach(([, next]) => recordFlagChanged(next));
        return new Set(
          action.changes
            .filter(
              ([prev, next]) => isPaidEnabled(prev) !== isPaidEnabled(next),
            )
            .map(([, next]) => next._id),
        );
      case "changed": {
        const nextIds = new Set(idsOf(action.next));
        const deletedIds = action.keys
          .map(Number)
          .filter((id) => !nextIds.has(id));
        deletedIds.forEach((id) => seen.delete(id));
        const changedIds = action.next
          .filter((account) => recordFlagChanged(account))
          .map(({ _id }) => _id);
        return new Set([...changedIds, ...deletedIds]);
      }
      case "resync":
      default:
        seen.clear();
        return "all";
    }
  };

  return {
    getFlagChangedIds,
    clear: () => {
      seen.clear();
    },
  };
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
  const seenFlags = createSeenFlags();

  const onAction = (action: AccountsAction): void => {
    const changed = seenFlags.getFlagChangedIds(action);
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
          // detached, the next actions would be missed
          seenFlags.clear();
        }
      };
    },
  };
};
