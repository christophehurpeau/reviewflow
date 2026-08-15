import type { MongoStores } from "reviewflow-core";
import { deleteRepoContext } from "../../../context/repoContext.ts";

export interface DeleteRepositoryDataOptions {
  mongoStores: MongoStores;
  repositoryId: number;
}

/**
 * Drops everything mirrored for a repository reviewflow no longer sees: deleted
 * on github, or removed from the installation. Nothing else can reach these
 * documents, since every webhook for that repository stopped as well.
 */
export const deleteRepositoryData = async ({
  mongoStores,
  repositoryId,
}: DeleteRepositoryDataOptions): Promise<void> => {
  // first: it awaits an in-flight context init, which would otherwise insert the
  // repository document back after the delete below
  await deleteRepoContext(repositoryId);

  await Promise.all([
    mongoStores.prs.deleteMany({ "repo.id": repositoryId }),
    mongoStores.labels.deleteMany({ "repo.id": repositoryId }),
  ]);
  await mongoStores.repositories.deleteByKey(repositoryId);
};
