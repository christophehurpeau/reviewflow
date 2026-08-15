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
    const { orgMember } = await requireOrgMember(mongoStores, accountId, user);
    return { user, accounts: [toPrBucketAccount(orgMember)] };
  }

  const orgMembers = await mongoStores.orgMembers.findAll({
    "user.id": user.id,
  });

  return {
    user,
    accounts: [ownAccount(user), ...orgMembers.map(toPrBucketAccount)],
  };
};
