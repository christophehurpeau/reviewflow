import type { AccountEmbed, MongoStores } from "../../../mongo.ts";

const mongoDuplicateKeyErrorCode = 11_000;

const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  (error as { code?: unknown }).code === mongoDuplicateKeyErrorCode;

export interface UpdateRepositoryAccountOptions {
  mongoStores: MongoStores;
  repositoryId: number;
  repoName: string;
  fullName: string;
  account: AccountEmbed;
}

/**
 * Moves a repository and its pull requests to the account currently owning it.
 * Used when a `repository.transferred` webhook is received, and when a transfer
 * is detected afterwards because the webhook was missed.
 */
export const updateRepositoryAccount = async ({
  mongoStores,
  repositoryId,
  repoName,
  fullName,
  account,
}: UpdateRepositoryAccountOptions): Promise<void> => {
  await mongoStores.repositories.partialUpdateByKey(repositoryId, {
    $set: { account, fullName },
  });

  await mongoStores.labels.partialUpdateMany(
    { "repo.id": repositoryId },
    { $set: { account, "repo.name": repoName } },
  );

  const prsToUpdate = await mongoStores.prs.findAll({
    "repo.id": repositoryId,
    "account.id": { $ne: account.id },
  });

  for (const pr of prsToUpdate) {
    try {
      await mongoStores.prs.partialUpdateOne(pr, {
        $set: { account, "repo.name": repoName },
      });
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      // a pull request was already recreated under the new account, this document is obsolete
      await mongoStores.prs.deleteOne(pr);
    }
  }
};
