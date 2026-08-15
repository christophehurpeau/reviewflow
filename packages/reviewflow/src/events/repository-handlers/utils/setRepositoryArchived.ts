import type { MongoStores } from "reviewflow-core";
import { deleteRepoContext } from "../../../context/repoContext.ts";

export interface SetRepositoryArchivedOptions {
  mongoStores: MongoStores;
  repositoryId: number;
  archived: boolean;
}

/**
 * An archive is reversible on github, so the repository, its settings and its
 * labels are kept and only flagged. Its pull requests are dropped: they can no
 * longer change, and reviewflow would keep showing them as open work.
 */
export const setRepositoryArchived = async ({
  mongoStores,
  repositoryId,
  archived,
}: SetRepositoryArchivedOptions): Promise<void> => {
  // first: it awaits an in-flight context init, which would otherwise insert
  // documents back after the update below
  await deleteRepoContext(repositoryId);

  await mongoStores.repositories.partialUpdateByKey(repositoryId, {
    $set: { archived },
  });

  if (archived) {
    await mongoStores.prs.deleteMany({ "repo.id": repositoryId });
  }
};
