import { beforeEach, describe, expect, test, vi } from "vitest";
import type { MongoStores, Repository } from "reviewflow-core";
import { deleteRepoContext } from "../../../context/repoContext.ts";
import { syncRepositoryLabels } from "../../../context/syncRepositoryLabels.ts";
import { deleteRepositoryData } from "../utils/deleteRepositoryData.ts";
import { setRepositoryArchived } from "../utils/setRepositoryArchived.ts";
import { updateRepositoryAccount } from "../utils/updateRepositoryAccount.ts";
import type { SyncRepositoryOctokit } from "./syncRepository.ts";
import { syncRepository } from "./syncRepository.ts";

vi.mock("../../../context/repoContext.ts", () => ({
  deleteRepoContext: vi.fn(() => Promise.resolve()),
}));
vi.mock("../../../context/syncRepositoryLabels.ts", () => ({
  syncRepositoryLabels: vi.fn(() => Promise.resolve()),
}));
vi.mock("../utils/deleteRepositoryData.ts", () => ({
  deleteRepositoryData: vi.fn(() => Promise.resolve()),
}));
vi.mock("../utils/setRepositoryArchived.ts", () => ({
  setRepositoryArchived: vi.fn(() => Promise.resolve()),
}));
vi.mock("../utils/updateRepositoryAccount.ts", () => ({
  updateRepositoryAccount: vi.fn(() => Promise.resolve()),
}));

const owner = { id: 1, login: "christophehurpeau", type: "User" };

const repository = {
  _id: 42,
  account: { id: 1, login: "christophehurpeau", type: "User" },
  fullName: "christophehurpeau/reviewflow",
  emoji: "",
} as unknown as Repository;

const githubRepository = {
  id: 42,
  name: "reviewflow",
  full_name: "christophehurpeau/reviewflow",
  description: ":tada: a description",
  owner,
};

const labels = [{ id: 7, name: "bug", color: "ff0000" }];

const listReposRoute = "listReposAccessibleToInstallation";
const listLabelsRoute = "listLabelsForRepo";

const createOctokit = (
  installationRepositories: unknown[],
): SyncRepositoryOctokit =>
  ({
    rest: {
      apps: { listReposAccessibleToInstallation: listReposRoute },
      issues: { listLabelsForRepo: listLabelsRoute },
    },
    paginate: vi.fn((route: string) =>
      Promise.resolve(
        route === listReposRoute ? installationRepositories : labels,
      ),
    ),
  }) as unknown as SyncRepositoryOctokit;

const partialUpdateByKey = vi.fn(() => Promise.resolve());
const mongoStores = {
  repositories: { partialUpdateByKey },
} as unknown as MongoStores;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("syncRepository", () => {
  test("deletes everything mirrored when the repository is gone", async () => {
    const result = await syncRepository({
      mongoStores,
      octokit: createOctokit([{ ...githubRepository, id: 43 }]),
      repository,
    });

    expect(result).toBe("deleted");
    expect(deleteRepositoryData).toHaveBeenCalledWith({
      mongoStores,
      repositoryId: 42,
    });
    expect(partialUpdateByKey).not.toHaveBeenCalled();
  });

  test("keeps the repository without its pull requests when it is archived", async () => {
    const result = await syncRepository({
      mongoStores,
      octokit: createOctokit([{ ...githubRepository, archived: true }]),
      repository,
    });

    expect(result).toBe("archived");
    expect(setRepositoryArchived).toHaveBeenCalledWith({
      mongoStores,
      repositoryId: 42,
      archived: true,
    });
    expect(deleteRepositoryData).not.toHaveBeenCalled();
    expect(partialUpdateByKey).not.toHaveBeenCalled();
  });

  test("updates the repository from github", async () => {
    const result = await syncRepository({
      mongoStores,
      octokit: createOctokit([githubRepository]),
      repository,
    });

    expect(result).toBe("synced");
    expect(deleteRepositoryData).not.toHaveBeenCalled();
    expect(partialUpdateByKey).toHaveBeenCalledWith(42, {
      $set: expect.objectContaining({
        account: { id: 1, login: "christophehurpeau", type: "User" },
        fullName: "christophehurpeau/reviewflow",
        emoji: ":tada:",
      }),
    });
    expect(deleteRepoContext).toHaveBeenCalledWith(42);
  });

  test("syncs the labels of the repository", async () => {
    await syncRepository({
      mongoStores,
      octokit: createOctokit([githubRepository]),
      repository,
    });

    expect(syncRepositoryLabels).toHaveBeenCalledWith({
      mongoStores,
      account: { id: 1, login: "christophehurpeau", type: "User" },
      repo: { id: 42, name: "reviewflow" },
      labels,
    });
  });

  test("leaves the labels of a repository ignored by its account config alone", async () => {
    await syncRepository({
      mongoStores,
      octokit: createOctokit([
        {
          ...githubRepository,
          name: "devenv",
          full_name: "ornikar/devenv",
          owner: { id: 2, login: "ornikar", type: "Organization" },
        },
      ]),
      repository,
    });

    expect(syncRepositoryLabels).not.toHaveBeenCalled();
  });

  test("moves the repository when it was transferred to another account", async () => {
    const newOwner = { id: 2, login: "ornikar", type: "Organization" };

    await syncRepository({
      mongoStores,
      octokit: createOctokit([
        {
          ...githubRepository,
          full_name: "ornikar/reviewflow",
          owner: newOwner,
        },
      ]),
      repository,
    });

    expect(updateRepositoryAccount).toHaveBeenCalledWith({
      mongoStores,
      repositoryId: 42,
      repoName: "reviewflow",
      fullName: "ornikar/reviewflow",
      account: { id: 2, login: "ornikar", type: "Organization" },
    });
  });
});
