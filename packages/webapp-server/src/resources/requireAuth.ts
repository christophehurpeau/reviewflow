import { ResourcesServerError } from "liwi-resources-server";
import type { MongoStores, OrgMember, PrBucketAccount } from "reviewflow-core";
import type { AuthenticatedWsUser } from "./getAuthenticatedUser.ts";

export const requireAuthenticatedUser = (
  loggedInUser: AuthenticatedWsUser | undefined,
): AuthenticatedWsUser => {
  if (!loggedInUser) {
    throw new ResourcesServerError("UNAUTHENTICATED", "Not authenticated");
  }
  return loggedInUser;
};

/**
 * Nothing about an org may be read without proving membership: the client only
 * ever sends an org id, and mongo has no other tenant boundary.
 */
export const requireOrgMember = async (
  mongoStores: MongoStores,
  orgId: number,
  loggedInUser: AuthenticatedWsUser | undefined,
): Promise<{ user: AuthenticatedWsUser; orgMember: OrgMember }> => {
  const user = requireAuthenticatedUser(loggedInUser);
  const orgMember = await mongoStores.orgMembers.findOne({
    "org.id": orgId,
    "user.id": user.id,
  });

  if (!orgMember) {
    throw new ResourcesServerError(
      "FORBIDDEN",
      "You are not a member of this organization",
    );
  }

  return { user, orgMember };
};

export interface AuthorizedAccount {
  id: number;
  login: string;
}

/**
 * An account is either the user's own — reviewflow installed on a personal
 * account, authorized by identity alone — or an org they belong to. Everything
 * scoped to an account id goes through here, the client never sends the login.
 */
export const requireAccount = async (
  mongoStores: MongoStores,
  accountId: number,
  loggedInUser: AuthenticatedWsUser | undefined,
): Promise<{ user: AuthenticatedWsUser; account: AuthorizedAccount }> => {
  const user = requireAuthenticatedUser(loggedInUser);

  if (accountId === user.id) {
    return { user, account: { id: user.id, login: user.login } };
  }

  await requireOrgMember(mongoStores, accountId, user);
  const org = await mongoStores.orgs.findByKey(accountId);
  if (!org) {
    throw new ResourcesServerError("NOT_FOUND", "Unknown organization");
  }

  return { user, account: { id: org._id, login: org.login } };
};

const toPrBucketAccount = (orgMember: OrgMember): PrBucketAccount => ({
  accountId: orgMember.org.id,
  teams: orgMember.teams,
});

/**
 * The user's own account holds no org membership document — reviewflow installed
 * on a personal account stores it in `users` — so it is scoped by identity
 * alone, and never needs a lookup to be authorized.
 */
const ownAccount = (user: AuthenticatedWsUser): PrBucketAccount => ({
  accountId: user.id,
  teams: [],
});

/**
 * One screen opens a query per pull request bucket at once, and they all resolve
 * the same memberships. The window is deliberately short: this gates
 * authorization, so a membership revoked in mongo has to stop the next screen.
 */
const membershipsTtlMs = 5000;

/** the account the query selected, `every` for the unscoped read spanning them all */
type AccountsCacheKey = number | "every";

/** the pending lookup, not its result: the bucket queries all arrive before any resolves */
interface CachedAccounts {
  accounts: Promise<PrBucketAccount[]>;
  expiresAt: number;
}

/**
 * Keyed by the user object the websocket resolved once at the upgrade, so an
 * entry cannot outlive the connection it was read for, nor reach another one.
 */
const accountsByUser = new WeakMap<
  AuthenticatedWsUser,
  Map<AccountsCacheKey, CachedAccounts>
>();

/** a rejected lookup is dropped rather than held, so a failure is retried at once */
const cachedAccounts = (
  user: AuthenticatedWsUser,
  key: AccountsCacheKey,
  lookup: () => Promise<PrBucketAccount[]>,
): Promise<PrBucketAccount[]> => {
  const byKey =
    accountsByUser.get(user) ?? new Map<AccountsCacheKey, CachedAccounts>();
  accountsByUser.set(user, byKey);

  const cached = byKey.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.accounts;

  const accounts = lookup().catch((error: unknown) => {
    byKey.delete(key);
    throw error;
  });
  byKey.set(key, { accounts, expiresAt: Date.now() + membershipsTtlMs });
  return accounts;
};

/**
 * `accountId: null` spans the user's own account and every org they belong to.
 * Identity and memberships stay the only things bounding the query, so an
 * unscoped read can never widen past them.
 */
export const requireAccounts = async (
  mongoStores: MongoStores,
  accountId: number | null,
  loggedInUser: AuthenticatedWsUser | undefined,
): Promise<{ user: AuthenticatedWsUser; accounts: PrBucketAccount[] }> => {
  const user = requireAuthenticatedUser(loggedInUser);

  if (accountId === user.id) {
    return { user, accounts: [ownAccount(user)] };
  }

  if (accountId !== null) {
    return {
      user,
      accounts: await cachedAccounts(user, accountId, async () => {
        const { orgMember } = await requireOrgMember(
          mongoStores,
          accountId,
          user,
        );
        return [toPrBucketAccount(orgMember)];
      }),
    };
  }

  return {
    user,
    accounts: await cachedAccounts(user, "every", async () => {
      const orgMembers = await mongoStores.orgMembers.findAll({
        "user.id": user.id,
      });
      return [ownAccount(user), ...orgMembers.map(toPrBucketAccount)];
    }),
  };
};
