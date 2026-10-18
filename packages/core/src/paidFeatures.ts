import type { MongoStores, PaidFeatures } from "./mongo.ts";

export const isPaidEnabled = (account: {
  paidFeatures?: PaidFeatures;
}): boolean => account.paidFeatures?.enabled === true;

const enabledCriteria = (accountIds: readonly number[]) =>
  ({
    _id: { $in: [...accountIds] },
    "paidFeatures.enabled": true,
  }) as const;

/** github shares ids between orgs and users, so one set holds both */
export const findEnabledAccountIds = async (
  { orgs, users }: Pick<MongoStores, "orgs" | "users">,
  accountIds: readonly number[],
): Promise<Set<number>> => {
  if (accountIds.length === 0) return new Set();
  const [enabledOrgs, enabledUsers] = await Promise.all([
    orgs.findAll(enabledCriteria(accountIds)),
    users.findAll(enabledCriteria(accountIds)),
  ]);
  return new Set([...enabledOrgs, ...enabledUsers].map(({ _id }) => _id));
};

/**
 * The rule for a subscription spanning several accounts: live as soon as one
 * of them is enabled. The single place to change it (for "all of them", swap
 * `some` for `every`).
 */
export const isLiveForAccounts = (
  accountIds: readonly number[],
  enabledIds: ReadonlySet<number>,
): boolean => accountIds.some((id) => enabledIds.has(id));
