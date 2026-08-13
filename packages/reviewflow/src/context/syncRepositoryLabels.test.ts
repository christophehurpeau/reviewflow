import { describe, expect, test, vi } from "vitest";
import type { AccountEmbed, Label, MongoStores } from "../mongo.ts";
import type { LabelResponse } from "./initRepoLabels.ts";
import { syncRepositoryLabels } from "./syncRepositoryLabels.ts";

const account: AccountEmbed = {
  id: 1,
  login: "reviewflow",
  type: "Organization",
};
const repo = { id: 42, name: "reviewflow-test" };

const createLabel = (
  id: number,
  name: string,
  color = "238636",
): LabelResponse => ({
  id,
  node_id: `MDU6TGFiZWwke${id}`,
  url: `https://api.github.com/repos/reviewflow/reviewflow-test/labels/${name}`,
  name,
  description: null,
  color,
  default: false,
});

const createExistingLabel = (
  label: LabelResponse,
  overrides: Partial<Label> = {},
): Label => {
  const existingLabel: Label = {
    _id: label.id,
    created: new Date(0),
    updated: new Date(0),
    account,
    repo,
    name: label.name,
    color: label.color,
    description: null,
  };
  return { ...existingLabel, ...overrides };
};

const createMongoStores = (existingLabels: Label[]) => {
  const upsertOne = vi.fn(() => Promise.resolve());
  const deleteMany = vi.fn(() => Promise.resolve());

  return {
    upsertOne,
    deleteMany,
    mongoStores: {
      labels: {
        findAll: vi.fn(() => Promise.resolve(existingLabels)),
        upsertOne,
        deleteMany,
      },
    } as unknown as MongoStores,
  };
};

const automergeLabel = createLabel(1, "automerge");
const needsReviewLabel = createLabel(2, "code/needs-review");

describe("syncRepositoryLabels", () => {
  test("inserts the labels not stored yet", async () => {
    const { mongoStores, upsertOne, deleteMany } = createMongoStores([]);

    await syncRepositoryLabels({
      mongoStores,
      account,
      repo,
      labels: [automergeLabel],
    });

    expect(upsertOne).toHaveBeenCalledWith({
      _id: 1,
      account,
      repo,
      name: "automerge",
      color: "238636",
      description: null,
    });
    expect(deleteMany).not.toHaveBeenCalled();
  });

  test("does not write the labels already up to date", async () => {
    const { mongoStores, upsertOne, deleteMany } = createMongoStores([
      createExistingLabel(automergeLabel),
      createExistingLabel(needsReviewLabel),
    ]);

    await syncRepositoryLabels({
      mongoStores,
      account,
      repo,
      labels: [automergeLabel, needsReviewLabel],
    });

    expect(upsertOne).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
  });

  test("updates a recolored label", async () => {
    const { mongoStores, upsertOne } = createMongoStores([
      createExistingLabel(automergeLabel, { color: "ffffff" }),
    ]);

    await syncRepositoryLabels({
      mongoStores,
      account,
      repo,
      labels: [automergeLabel],
    });

    expect(upsertOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 1, color: "238636" }),
    );
  });

  test("updates the labels of a renamed repository", async () => {
    const { mongoStores, upsertOne } = createMongoStores([
      createExistingLabel(automergeLabel, {
        repo: { id: 42, name: "previous-name" },
      }),
    ]);

    await syncRepositoryLabels({
      mongoStores,
      account,
      repo,
      labels: [automergeLabel],
    });

    expect(upsertOne).toHaveBeenCalledWith(expect.objectContaining({ repo }));
  });

  test("deletes the labels removed from the repository", async () => {
    const { mongoStores, upsertOne, deleteMany } = createMongoStores([
      createExistingLabel(automergeLabel),
      createExistingLabel(needsReviewLabel),
    ]);

    await syncRepositoryLabels({
      mongoStores,
      account,
      repo,
      labels: [automergeLabel],
    });

    expect(upsertOne).not.toHaveBeenCalled();
    expect(deleteMany).toHaveBeenCalledWith({
      "repo.id": 42,
      _id: { $in: [2] },
    });
  });
});
