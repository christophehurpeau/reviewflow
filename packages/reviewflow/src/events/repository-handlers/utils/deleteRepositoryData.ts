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
  // deleteMany, not deleteByKey: the subscribe store's deleteByKey reads the
  // document before deleting it and throws when it is already missing, which
  // happens when github delivers both repository.deleted and
  // installation_repositories.removed, or when reviewflow never stored it
  await mongoStores.repositories.deleteMany({ _id: repositoryId });
};
