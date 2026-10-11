import { NotFoundError } from "liwi-store";
import type { AccountEmbed, MongoStores } from "reviewflow-core";

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
  // the repository may never have been seen by the bot: nothing to move then
  try {
    await mongoStores.repositories.partialUpdateByKey(
      repositoryId,
      { $set: { account, fullName } },
      undefined,
      { touchUpdated: false },
    );
  } catch (error) {
    if (!(error instanceof NotFoundError)) throw error;
  }

  await mongoStores.labels.partialUpdateMany(
    { "repo.id": repositoryId },
    { $set: { account, "repo.name": repoName } },
    { touchUpdated: false },
  );

  const prsToUpdate = await mongoStores.prs.findAll({
    "repo.id": repositoryId,
    "account.id": { $ne: account.id },
  });

  for (const pr of prsToUpdate) {
    try {
      await mongoStores.prs.partialUpdateOne(
        pr,
        { $set: { account, "repo.name": repoName } },
        // moving a pull request is not activity: it must not postpone retention
        { touchUpdated: false },
      );
    } catch (error) {
      // deleted since it was listed (archive, repository or installation removal)
      if (error instanceof NotFoundError) continue;
      if (!isDuplicateKeyError(error)) throw error;
      // a pull request was already recreated under the new account, this document is obsolete
      await mongoStores.prs.deleteOne(pr);
    }
  }
};
