import type { MongoStores } from "reviewflow-core";
import type { AuthenticatedWsUser } from "./getAuthenticatedUser.ts";
import { forgetAccounts } from "./requireAuth.ts";

export interface MembershipScopes {
  /**
   * `onChange` runs after a membership of the user was inserted, updated or
   * deleted, whoever wrote it, and after a resync: the accounts cached for the
   * user are forgotten first, so it reads the new memberships.
   */
  watch: (user: AuthenticatedWsUser, onChange: () => void) => () => void;
}

type OrgMembersListener = Parameters<MongoStores["orgMembers"]["subscribe"]>[0];
type OrgMembersAction = Parameters<OrgMembersListener>[0];

/** `<orgId>_<userId>`, the only thing known of a document deleted by the bot */
const userIdOfKey = (key: number | string): number =>
  Number(String(key).slice(String(key).lastIndexOf("_") + 1));

const getConcernedUserIds = (
  action: OrgMembersAction,
): ReadonlySet<number> | "all" => {
  switch (action.type) {
    case "inserted":
      return new Set(action.next.map(({ user }) => user.id));
    case "deleted":
      return new Set(action.prev.map(({ user }) => user.id));
    case "updated":
      return new Set(
        action.changes.flatMap(([prev, next]) => [prev.user.id, next.user.id]),
      );
    case "changed":
      return new Set([
        ...action.keys.map(userIdOfKey),
        ...action.next.map(({ user }) => user.id),
      ]);
    case "resync":
    default:
      return "all";
  }
};

interface Watcher {
  user: AuthenticatedWsUser;
  onChange: () => void;
}

/**
 * One listener on `orgMembers`, attached while something watches: a liwi
 * subscription cannot change its criteria, so each scoped one re-reads its scope
 * from here.
 */
export const createMembershipScopes = (
  orgMembers: Pick<MongoStores["orgMembers"], "subscribe">,
): MembershipScopes => {
  const watchersByUserId = new Map<number, Set<Watcher>>();
  let unsubscribe: (() => void) | undefined;

  const notify = (watchers: Watcher[]): void => {
    new Set(watchers.map(({ user }) => user)).forEach(forgetAccounts);
    watchers.forEach(({ onChange }) => {
      onChange();
    });
  };

  const onAction: OrgMembersListener = (action) => {
    const concerned = getConcernedUserIds(action);
    const userIds = concerned === "all" ? watchersByUserId.keys() : concerned;
    notify([...userIds].flatMap((id) => [...(watchersByUserId.get(id) ?? [])]));
  };

  return {
    watch: (user, onChange) => {
      const watcher: Watcher = { user, onChange };
      const watchers = watchersByUserId.get(user.id) ?? new Set<Watcher>();
      watchers.add(watcher);
      watchersByUserId.set(user.id, watchers);
      unsubscribe ??= orgMembers.subscribe(onAction);

      return () => {
        watchers.delete(watcher);
        if (watchers.size === 0) watchersByUserId.delete(user.id);
        if (watchersByUserId.size === 0) {
          unsubscribe?.();
          unsubscribe = undefined;
        }
      };
    },
  };
};
