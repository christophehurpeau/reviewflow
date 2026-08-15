import type { OrgSummary, UserSummary } from "reviewflow-modules";

export interface PrAccount {
  id: number;
  login: string;
}

/**
 * Pull requests live under the account owning the repository: the user's own
 * account is one of them, and it has no org membership to be listed from.
 */
export const buildPrAccounts = (
  me: UserSummary | undefined,
  orgs: OrgSummary[],
): PrAccount[] => [
  ...(me?.installed ? [{ id: me._id, login: me.login }] : []),
  ...orgs.map((org) => ({ id: org._id, login: org.login })),
];
