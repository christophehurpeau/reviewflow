import { isPaidEnabled } from "reviewflow-core";
import type { AccountType, MongoStores, OrgTeamEmbed } from "reviewflow-core";
import { orgAllowsPersonalTokens } from "../orgAllowsPersonalTokens.ts";
import type { ApiAuth } from "./authenticatePersonalToken.ts";

export interface TokenAccount {
  id: number;
  login: string;
  type: AccountType;
  teams: OrgTeamEmbed[];
}

/**
 * Same window as the websocket memberships cache: short, because it gates
 * authorization, so a membership removed or a policy switched off stops the
 * next requests.
 */
const accountsTtlMs = 5000;

interface CachedAccounts {
  accounts: Promise<TokenAccount[]>;
  expiresAt: number;
}

const accountsByTokenId = new Map<string, CachedAccounts>();

const lookupAccounts = async (
  mongoStores: MongoStores,
  { user }: ApiAuth,
): Promise<TokenAccount[]> => {
  const orgMembers = await mongoStores.orgMembers.findAll({
    "user.id": user.id,
  });
  const orgs = await mongoStores.orgs.findAll({
    _id: { $in: orgMembers.map(({ org }) => org.id) },
  });
  const allowedOrgIds = new Set(
    orgs
      .filter((org) => isPaidEnabled(org) && orgAllowsPersonalTokens(org))
      .map(({ _id }) => _id),
  );
  const ownAccount = await mongoStores.users.findByKey(user.id);

  const own: TokenAccount[] =
    ownAccount && isPaidEnabled(ownAccount)
      ? [{ id: user.id, login: user.login, type: "User", teams: [] }]
      : [];

  return [
    // the user's own account needs no policy, only the admin's enabling
    ...own,
    ...orgMembers
      .filter(({ org }) => allowedOrgIds.has(org.id))
      .map(({ org, teams }): TokenAccount => ({
        id: org.id,
        login: org.login,
        type: "Organization",
        teams,
      })),
  ];
};

/**
 * The accounts a token reads, all enabled by the admin: the user's own, and
 * each org they belong to whose owners allow personal tokens. A rejected
 * lookup is not cached.
 */
export const resolveTokenAccounts = (
  mongoStores: MongoStores,
  auth: ApiAuth,
): Promise<TokenAccount[]> => {
  const cached = accountsByTokenId.get(auth.token._id);
  if (cached && cached.expiresAt > Date.now()) return cached.accounts;

  const accounts = lookupAccounts(mongoStores, auth).catch((error: unknown) => {
    accountsByTokenId.delete(auth.token._id);
    throw error;
  });
  accountsByTokenId.set(auth.token._id, {
    accounts,
    expiresAt: Date.now() + accountsTtlMs,
  });
  return accounts;
};
