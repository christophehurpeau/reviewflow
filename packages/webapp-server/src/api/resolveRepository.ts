import type { MongoStores, Repository } from "reviewflow-core";
import type { ApiAuth } from "./authenticatePersonalToken.ts";
import type { TokenAccount } from "./tokenAccounts.ts";
import { resolveTokenAccounts } from "./tokenAccounts.ts";

/**
 * `forbidden`: the owner is outside what the token reads (or is no account at
 * all). `unknownRepository`: the owner is readable, reviewflow knows no such
 * repository.
 */
export type ResolvedRepository =
  | { status: "forbidden" }
  | { status: "ok"; account: TokenAccount; repository: Repository }
  | { status: "unknownRepository"; account: TokenAccount };

const escapeRegExp = (value: string): string =>
  value.replaceAll(/[$()*+.?[\\\]^{|}]/g, String.raw`\$&`);

/**
 * `owner/repo` to the ids the `prs` indexes use. Access is decided on the
 * owner alone, from the accounts the token reads, before any data is looked
 * up: whether a repository or a pull request exists never shows through the
 * answer for an account the token cannot read. The owner is not matched
 * against stored logins of the repository (an account rename is not handled),
 * only against the token's accounts; the repository is then found by account
 * id. GitHub names are case-insensitive.
 */
export const resolveRepository = async (
  mongoStores: MongoStores,
  auth: ApiAuth,
  owner: string,
  repoName: string,
): Promise<ResolvedRepository> => {
  const accounts = await resolveTokenAccounts(mongoStores, auth);
  const account = accounts.find(
    ({ login }) => login.toLowerCase() === owner.toLowerCase(),
  );
  if (!account) return { status: "forbidden" };

  const repository = await mongoStores.repositories.findOne({
    "account.id": account.id,
    fullName: {
      $regex: `^${escapeRegExp(`${account.login}/${repoName}`)}$`,
      $options: "i",
    },
  });
  if (!repository) return { status: "unknownRepository", account };

  return { status: "ok", account, repository };
};
