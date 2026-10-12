import { describe, expect, it, vi } from "vitest";
import type { MongoStores } from "reviewflow-core";
import {
  hasOpenPullRequestsOnBase,
  invalidateMergeableOnBasePush,
} from "./pushInvalidatesMergeable.ts";
import type { PullRequestWithDecentData } from "./utils/PullRequestData.ts";
import { getMergeableFromPullRequest } from "./utils/createPullRequestContext.ts";

const createStores = () => {
  const partialUpdateMany = vi.fn(() => Promise.resolve());
  const mongoStores = { prs: { partialUpdateMany } } as unknown as MongoStores;
  return { mongoStores, partialUpdateMany };
};

describe("invalidateMergeableOnBasePush", () => {
  it("sets the open pull requests based on the pushed branch back to unknown", async () => {
    const { mongoStores, partialUpdateMany } = createStores();

    await invalidateMergeableOnBasePush(mongoStores, {
      accountId: 1,
      repositoryId: 2,
      ref: "refs/heads/main",
    });

    expect(partialUpdateMany).toHaveBeenCalledWith(
      {
        "account.id": 1,
        "repo.id": 2,
        baseRef: "main",
        isClosed: false,
        mergeable: { $in: ["conflicting", "mergeable"] },
      },
      { $set: { mergeable: "unknown" } },
    );
  });

  it("keeps the slashes of a nested branch name", async () => {
    const { mongoStores, partialUpdateMany } = createStores();

    await invalidateMergeableOnBasePush(mongoStores, {
      accountId: 1,
      repositoryId: 2,
      ref: "refs/heads/release/2026-10",
    });

    expect(partialUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ baseRef: "release/2026-10" }),
      expect.anything(),
    );
  });

  it("ignores a pushed tag", async () => {
    const { mongoStores, partialUpdateMany } = createStores();

    await invalidateMergeableOnBasePush(mongoStores, {
      accountId: 1,
      repositoryId: 2,
      ref: "refs/tags/v1.0.0",
    });

    expect(partialUpdateMany).not.toHaveBeenCalled();
  });
});

describe("hasOpenPullRequestsOnBase", () => {
  const createFindOneStores = (pr: unknown) => {
    const findOne = vi.fn(() => Promise.resolve(pr));
    const mongoStores = { prs: { findOne } } as unknown as MongoStores;
    return { mongoStores, findOne };
  };

  it("looks for an open pull request based on the pushed branch", async () => {
    const { mongoStores, findOne } = createFindOneStores({ _id: "pr" });

    await expect(
      hasOpenPullRequestsOnBase(mongoStores, {
        accountId: 1,
        repositoryId: 2,
        ref: "refs/heads/main",
      }),
    ).resolves.toBe(true);
    expect(findOne).toHaveBeenCalledWith({
      "account.id": 1,
      "repo.id": 2,
      baseRef: "main",
      isClosed: false,
    });
  });

  it("is false when no open pull request is based on it", async () => {
    const { mongoStores } = createFindOneStores(undefined);

    await expect(
      hasOpenPullRequestsOnBase(mongoStores, {
        accountId: 1,
        repositoryId: 2,
        ref: "refs/heads/feat/x",
      }),
    ).resolves.toBe(false);
  });

  it("is false for a pushed tag", async () => {
    const { mongoStores, findOne } = createFindOneStores({ _id: "pr" });

    await expect(
      hasOpenPullRequestsOnBase(mongoStores, {
        accountId: 1,
        repositoryId: 2,
        ref: "refs/tags/v1.0.0",
      }),
    ).resolves.toBe(false);
    expect(findOne).not.toHaveBeenCalled();
  });
});

describe("getMergeableFromPullRequest", () => {
  const withMergeable = (mergeable: boolean | null) =>
    ({ mergeable }) as unknown as PullRequestWithDecentData;

  it.each([
    [true, "mergeable"],
    [false, "conflicting"],
    [null, "unknown"],
  ] as const)("maps github's %j to %j", (mergeable, expected) => {
    expect(getMergeableFromPullRequest(withMergeable(mergeable))).toEqual({
      mergeable: expected,
    });
  });

  it("leaves the stored value alone when the payload has no such field", () => {
    expect(
      getMergeableFromPullRequest({
        number: 1,
      }),
    ).toBeUndefined();
  });
});
