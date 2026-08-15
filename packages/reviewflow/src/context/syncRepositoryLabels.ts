import type { AccountEmbed, Label, MongoStores } from "reviewflow-core";
import type { LabelResponse } from "./initRepoLabels.ts";

interface RepoEmbed {
  id: Label["repo"]["id"];
  name: Label["repo"]["name"];
}

export interface SyncRepositoryLabelsOptions {
  mongoStores: MongoStores;
  account: AccountEmbed;
  repo: RepoEmbed;
  labels: LabelResponse[];
}

/**
 * Keeps the `labels` collection aligned with the labels of a repository, so that
 * the labels of a pull request can be displayed without calling github.
 */
export const syncRepositoryLabels = async ({
  mongoStores,
  account,
  repo,
  labels,
}: SyncRepositoryLabelsOptions): Promise<void> => {
  const existingLabels = await mongoStores.labels.findAll({
    "repo.id": repo.id,
  });
  const existingLabelsById = new Map(
    existingLabels.map((label) => [label._id, label]),
  );

  const isUpToDate = (label: LabelResponse): boolean => {
    const existing = existingLabelsById.get(label.id);
    return (
      existing?.account.id === account.id &&
      existing.repo.name === repo.name &&
      existing.name === label.name &&
      existing.color === label.color &&
      (existing.description ?? null) === (label.description ?? null)
    );
  };

  for (const label of labels.filter((label) => !isUpToDate(label))) {
    await mongoStores.labels.upsertOne({
      _id: label.id,
      account,
      repo,
      name: label.name,
      color: label.color,
      description: label.description ?? null,
    });
  }

  const currentIds = new Set(labels.map((label) => label.id));
  const removedIds = existingLabels
    .map((label) => label._id)
    .filter((id) => !currentIds.has(id));

  if (removedIds.length > 0) {
    await mongoStores.labels.deleteMany({
      "repo.id": repo.id,
      _id: { $in: removedIds },
    });
  }
};
