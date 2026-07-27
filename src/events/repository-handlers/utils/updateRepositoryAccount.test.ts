import { describe, expect, test, vi } from "vitest";
import type {
  AccountEmbed,
  MongoStores,
  ReviewflowPr,
} from "../../../mongo.ts";
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

  return {
    partialUpdateByKeyRepository,
    partialUpdateOnePr,
    deleteOnePr,
    mongoStores: {
      repositories: { partialUpdateByKey: partialUpdateByKeyRepository },
      prs: {
        findAll: vi.fn(() => Promise.resolve(prsToUpdate)),
        partialUpdateOne: partialUpdateOnePr,
        deleteOne: deleteOnePr,
      },
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

    expect(partialUpdateByKeyRepository).toHaveBeenCalledWith(42, {
      $set: { account, fullName: "new-owner/new-name" },
    });
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
    expect(partialUpdateOnePr).toHaveBeenCalledWith(stalePr, {
      $set: { account, "repo.name": "new-name" },
    });
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
