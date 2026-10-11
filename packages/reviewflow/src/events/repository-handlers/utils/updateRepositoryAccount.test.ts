import { describe, expect, test, vi } from "vitest";
import { NotFoundError } from "liwi-store";
import type { AccountEmbed, MongoStores, ReviewflowPr } from "reviewflow-core";
import { updateRepositoryAccount } from "./updateRepositoryAccount.ts";

const account: AccountEmbed = {
  id: 2,
  login: "new-owner",
  type: "Organization",
};

const createStalePr = (number: number): ReviewflowPr =>
  ({
    _id: `pr-${number}`,
    account: { id: 1, login: "previous-owner", type: "User" },
    repo: { id: 42, name: "previous-name" },
    pr: { number },
  }) as unknown as ReviewflowPr;

const createMongoStores = (prsToUpdate: ReviewflowPr[]) => {
  const partialUpdateByKeyRepository = vi.fn(() => Promise.resolve());
  const partialUpdateOnePr = vi.fn(() => Promise.resolve());
  const deleteOnePr = vi.fn(() => Promise.resolve());
  const partialUpdateManyLabels = vi.fn(() => Promise.resolve());

  return {
    partialUpdateByKeyRepository,
    partialUpdateOnePr,
    deleteOnePr,
    partialUpdateManyLabels,
    mongoStores: {
      repositories: { partialUpdateByKey: partialUpdateByKeyRepository },
      prs: {
        findAll: vi.fn(() => Promise.resolve(prsToUpdate)),
        partialUpdateOne: partialUpdateOnePr,
        deleteOne: deleteOnePr,
      },
      labels: { partialUpdateMany: partialUpdateManyLabels },
    } as unknown as MongoStores,
  };
};

const options = { repositoryId: 42, repoName: "new-name", account };

describe("updateRepositoryAccount", () => {
  test("updates the repository account and full name", async () => {
    const { mongoStores, partialUpdateByKeyRepository } = createMongoStores([]);

    await updateRepositoryAccount({
      mongoStores,
      ...options,
      fullName: "new-owner/new-name",
    });

    expect(partialUpdateByKeyRepository).toHaveBeenCalledWith(
      42,
      { $set: { account, fullName: "new-owner/new-name" } },
      undefined,
      { touchUpdated: false },
    );
  });

  test("still moves labels and pull requests when the repository is not stored", async () => {
    const stalePr = createStalePr(1);
    const {
      mongoStores,
      partialUpdateByKeyRepository,
      partialUpdateManyLabels,
      partialUpdateOnePr,
    } = createMongoStores([stalePr]);
    partialUpdateByKeyRepository.mockRejectedValue(new NotFoundError());

    await updateRepositoryAccount({
      mongoStores,
      ...options,
      fullName: "new-owner/new-name",
    });

    expect(partialUpdateManyLabels).toHaveBeenCalledTimes(1);
    expect(partialUpdateOnePr).toHaveBeenCalledTimes(1);
  });

  test("skips a pull request deleted since it was listed", async () => {
    const { mongoStores, partialUpdateOnePr, deleteOnePr } = createMongoStores([
      createStalePr(1),
      createStalePr(2),
    ]);
    partialUpdateOnePr.mockRejectedValueOnce(new NotFoundError());

    await updateRepositoryAccount({
      mongoStores,
      ...options,
      fullName: "new-owner/new-name",
    });

    expect(partialUpdateOnePr).toHaveBeenCalledTimes(2);
    expect(deleteOnePr).not.toHaveBeenCalled();
  });

  test("moves the labels of the repository", async () => {
    const { mongoStores, partialUpdateManyLabels } = createMongoStores([]);

    await updateRepositoryAccount({
      mongoStores,
      ...options,
      fullName: "new-owner/new-name",
    });

    expect(partialUpdateManyLabels).toHaveBeenCalledWith(
      { "repo.id": 42 },
      { $set: { account, "repo.name": "new-name" } },
      { touchUpdated: false },
    );
  });

  test("moves the pull requests left on the previous account", async () => {
    const stalePr = createStalePr(1);
    const { mongoStores, partialUpdateOnePr, deleteOnePr } = createMongoStores([
      stalePr,
    ]);

    await updateRepositoryAccount({
      mongoStores,
      ...options,
      fullName: "new-owner/new-name",
    });

    expect(mongoStores.prs.findAll).toHaveBeenCalledWith({
      "repo.id": 42,
      "account.id": { $ne: 2 },
    });
    expect(partialUpdateOnePr).toHaveBeenCalledWith(
      stalePr,
      { $set: { account, "repo.name": "new-name" } },
      { touchUpdated: false },
    );
    expect(deleteOnePr).not.toHaveBeenCalled();
  });

  test("deletes the pull request already recreated on the new account", async () => {
    const stalePr = createStalePr(1);
    const { mongoStores, deleteOnePr } = createMongoStores([stalePr]);
    vi.mocked(mongoStores.prs.partialUpdateOne).mockRejectedValue(
      Object.assign(new Error("E11000 duplicate key error"), { code: 11_000 }),
    );

    await updateRepositoryAccount({
      mongoStores,
      ...options,
      fullName: "new-owner/new-name",
    });

    expect(deleteOnePr).toHaveBeenCalledWith(stalePr);
  });

  test("rethrows errors other than duplicate key", async () => {
    const { mongoStores, deleteOnePr } = createMongoStores([createStalePr(1)]);
    vi.mocked(mongoStores.prs.partialUpdateOne).mockRejectedValue(
      new Error("connection lost"),
    );

    await expect(
      updateRepositoryAccount({
        mongoStores,
        ...options,
        fullName: "new-owner/new-name",
      }),
    ).rejects.toThrow("connection lost");
    expect(deleteOnePr).not.toHaveBeenCalled();
  });
});
