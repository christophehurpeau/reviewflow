import { describe, expect, it, vi } from "vitest";
import { NotFoundError } from "liwi-store";
import type { MongoStores, Repository, ReviewflowPr } from "reviewflow-core";
import { backfillPrBranches } from "./backfillPrBranches.ts";

const createRepository = (
  id: number,
  overrides: Partial<Repository> = {},
): Repository =>
  ({
    _id: id,
    account: { id: 1, login: "acme", type: "Organization" },
    fullName: `acme/repo-${id}`,
    ...overrides,
  }) as unknown as Repository;

const createPr = (
  number: number,
  overrides: Partial<ReviewflowPr> = {},
): ReviewflowPr =>
  ({
    _id: `pr-${number}`,
    pr: { number },
    isClosed: false,
    ...overrides,
  }) as unknown as ReviewflowPr;

const githubPull = (overrides: Record<string, unknown> = {}) => ({
  headers: { "x-ratelimit-remaining": "4000", "x-ratelimit-reset": "1000" },
  data: {
    state: "open",
    merged: false,
    head: { ref: "feature", repo: { full_name: "fork/repo" } },
    base: { ref: "main" },
    ...overrides,
  },
});

const githubError = (
  status: number,
  headers: Record<string, string> = {},
  message = "error",
) => Object.assign(new Error(message), { status, response: { headers } });

interface Setup {
  repositories?: Repository[];
  prsByRepository?: Record<number, ReviewflowPr[]>;
  installationId?: number | null;
  pullsGet?: ReturnType<typeof vi.fn>;
  reposGet?: ReturnType<typeof vi.fn>;
  auth?: ReturnType<typeof vi.fn>;
  partialUpdateOne?: ReturnType<typeof vi.fn>;
}

const setup = ({
  repositories = [createRepository(10)],
  prsByRepository = {},
  installationId = 99,
  pullsGet = vi.fn(() => Promise.resolve(githubPull())),
  reposGet = vi.fn(() => Promise.resolve({})),
  partialUpdateOne = vi.fn(() => Promise.resolve()),
  auth = vi.fn(() =>
    Promise.resolve({
      rest: { pulls: { get: pullsGet }, repos: { get: reposGet } },
    }),
  ),
}: Setup = {}) => {
  const partialUpdateByKey = vi.fn(() => Promise.resolve());
  const mongoStores = {
    repositories: {
      findAll: vi.fn(() => Promise.resolve(repositories)),
      findByKey: vi.fn((id: number) =>
        Promise.resolve(repositories.find(({ _id }) => _id === id)),
      ),
      partialUpdateByKey,
    },
    orgs: {
      findByKey: vi.fn(() =>
        Promise.resolve({ installationId: installationId ?? undefined }),
      ),
    },
    users: { findByKey: vi.fn(() => Promise.resolve(undefined)) },
    prs: {
      findAll: vi.fn((criteria: { "repo.id": number }) =>
        Promise.resolve(prsByRepository[criteria["repo.id"]] ?? []),
      ),
      partialUpdateOne,
    },
  } as unknown as MongoStores;

  return {
    mongoStores,
    auth,
    pullsGet,
    reposGet,
    partialUpdateOne,
    partialUpdateByKey,
  };
};

const run = (
  { mongoStores, auth }: ReturnType<typeof setup>,
  options: { dryRun?: boolean; repositoryId?: number } = {},
) =>
  backfillPrBranches({
    mongoStores,
    auth,
    dryRun: false,
    ...options,
  } as Parameters<typeof backfillPrBranches>[0]);

describe("backfillPrBranches", () => {
  it("writes the missing fields without touching updated, then stamps the repository", async () => {
    const harness = setup({
      prsByRepository: { 10: [createPr(1)] },
    });

    const [report] = await run(harness);

    expect(harness.pullsGet).toHaveBeenCalledWith({
      owner: "acme",
      repo: "repo-10",
      pull_number: 1,
    });
    expect(harness.partialUpdateOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: "pr-1" }),
      {
        $set: {
          headRef: "feature",
          baseRef: "main",
          headRepoFullName: "fork/repo",
        },
      },
      { touchUpdated: false },
    );
    expect(harness.partialUpdateByKey).toHaveBeenCalledWith(
      10,
      { $set: { prBranchesBackfilledAt: expect.any(Date) } },
      undefined,
      { touchUpdated: false },
    );
    expect(report).toMatchObject({
      status: "complete",
      candidates: 1,
      written: 1,
      completionRecorded: true,
    });
  });

  it("keeps the fields a webhook already wrote and sets isMerged on a closed document only", async () => {
    const harness = setup({
      prsByRepository: {
        10: [
          createPr(1, { headRef: "fresh", baseRef: "main", isClosed: true }),
          createPr(2, {
            headRef: "x",
            baseRef: "main",
            headRepoFullName: null,
          }),
        ],
      },
      pullsGet: vi.fn(() =>
        Promise.resolve(
          githubPull({
            state: "closed",
            merged: true,
            head: { ref: "feature", repo: null },
          }),
        ),
      ),
    });

    const [report] = await run(harness);

    expect(harness.partialUpdateOne).toHaveBeenCalledTimes(1);
    expect(harness.partialUpdateOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: "pr-1" }),
      { $set: { headRepoFullName: null, isMerged: true } },
      { touchUpdated: false },
    );
    expect(report!.stateMismatches).toBe(1);
  });

  it("stores a deleted head repository as null", async () => {
    const harness = setup({
      prsByRepository: { 10: [createPr(1)] },
      pullsGet: vi.fn(() =>
        Promise.resolve(githubPull({ head: { ref: "feature", repo: null } })),
      ),
    });

    await run(harness);

    expect(harness.partialUpdateOne).toHaveBeenCalledWith(
      expect.anything(),
      {
        $set: {
          headRef: "feature",
          baseRef: "main",
          headRepoFullName: null,
        },
      },
      expect.anything(),
    );
  });

  it("reports a dry run without writing nor stamping", async () => {
    const harness = setup({ prsByRepository: { 10: [createPr(1)] } });

    const [report] = await run(harness, { dryRun: true });

    expect(harness.partialUpdateOne).not.toHaveBeenCalled();
    expect(harness.partialUpdateByKey).not.toHaveBeenCalled();
    expect(report).toMatchObject({
      status: "complete",
      written: 1,
      completionRecorded: false,
      samples: [
        {
          number: 1,
          set: {
            headRef: "feature",
            baseRef: "main",
            headRepoFullName: "fork/repo",
          },
        },
      ],
    });
  });

  it("stamps a repository with nothing to backfill without calling github", async () => {
    const harness = setup();

    const [report] = await run(harness);

    expect(harness.auth).not.toHaveBeenCalled();
    expect(harness.partialUpdateByKey).toHaveBeenCalledTimes(1);
    expect(report).toMatchObject({
      status: "complete",
      completionRecorded: true,
    });
  });

  it("keeps the previous stamp of a repository with nothing left", async () => {
    const harness = setup({
      repositories: [
        createRepository(10, { prBranchesBackfilledAt: new Date(0) }),
      ],
    });

    const [report] = await run(harness);

    expect(harness.partialUpdateByKey).not.toHaveBeenCalled();
    expect(report).toMatchObject({
      status: "complete",
      completionRecorded: true,
    });
  });

  it("leaves a pull request github no longer returns and still completes", async () => {
    const harness = setup({
      prsByRepository: { 10: [createPr(1), createPr(2)] },
      pullsGet: vi
        .fn()
        .mockRejectedValueOnce(githubError(404))
        .mockResolvedValueOnce(githubPull()),
    });

    const [report] = await run(harness);

    expect(harness.reposGet).toHaveBeenCalledTimes(1);
    expect(harness.partialUpdateOne).toHaveBeenCalledTimes(1);
    expect(report).toMatchObject({
      status: "complete",
      notFoundOnGithub: 1,
      written: 1,
      completionRecorded: true,
    });
  });

  it("stops without stamping when the repository itself answers 404", async () => {
    const harness = setup({
      prsByRepository: { 10: [createPr(1), createPr(2)] },
      pullsGet: vi.fn(() => Promise.reject(githubError(404))),
      reposGet: vi.fn(() => Promise.reject(githubError(404))),
    });

    const [report] = await run(harness);

    expect(harness.pullsGet).toHaveBeenCalledTimes(1);
    expect(harness.partialUpdateByKey).not.toHaveBeenCalled();
    expect(report).toMatchObject({
      status: "repositoryGone",
      completionRecorded: false,
    });
  });

  it("reports a repository whose account has no installation", async () => {
    const harness = setup({
      installationId: null,
      prsByRepository: { 10: [createPr(1)] },
    });

    const [report] = await run(harness);

    expect(harness.auth).not.toHaveBeenCalled();
    expect(report).toMatchObject({ status: "noInstallation" });
    expect(harness.partialUpdateByKey).not.toHaveBeenCalled();
  });

  it("reports an installation that cannot be authenticated", async () => {
    const harness = setup({
      prsByRepository: { 10: [createPr(1)] },
      auth: vi.fn(() => Promise.reject(new Error("installation gone"))),
    });

    const [report] = await run(harness);

    expect(report).toMatchObject({ status: "authFailed" });
    expect(harness.partialUpdateByKey).not.toHaveBeenCalled();
  });

  it("stops under the quota reserve and skips the other repositories of the installation", async () => {
    const harness = setup({
      repositories: [createRepository(10), createRepository(11)],
      prsByRepository: { 10: [createPr(1), createPr(2)], 11: [createPr(3)] },
      pullsGet: vi.fn(() =>
        Promise.resolve({
          ...githubPull(),
          headers: {
            "x-ratelimit-remaining": "499",
            "x-ratelimit-reset": "1234",
          },
        }),
      ),
    });

    const reports = await run(harness);

    expect(harness.pullsGet).toHaveBeenCalledTimes(1);
    expect(harness.partialUpdateOne).toHaveBeenCalledTimes(1);
    expect(reports.map(({ status }) => status)).toEqual([
      "rateLimited",
      "rateLimited",
    ]);
    expect(reports[0]).toMatchObject({
      rateLimitResetsAt: 1234,
      completionRecorded: false,
    });
    expect(harness.partialUpdateByKey).not.toHaveBeenCalled();
  });

  it("stops on a rate limit error", async () => {
    const harness = setup({
      prsByRepository: { 10: [createPr(1), createPr(2)] },
      pullsGet: vi.fn(() =>
        Promise.reject(
          githubError(403, {
            "x-ratelimit-remaining": "0",
            "x-ratelimit-reset": "777",
          }),
        ),
      ),
    });

    const [report] = await run(harness);

    expect(harness.pullsGet).toHaveBeenCalledTimes(1);
    expect(report).toMatchObject({
      status: "rateLimited",
      rateLimitResetsAt: 777,
    });
  });

  it("treats a 403 that is not a rate limit as a lost access", async () => {
    const harness = setup({
      prsByRepository: { 10: [createPr(1)] },
      pullsGet: vi.fn(() =>
        Promise.reject(githubError(403, {}, "Resource not accessible")),
      ),
    });

    const [report] = await run(harness);

    expect(report).toMatchObject({ status: "authFailed" });
  });

  it("does not stamp a repository when a request failed, and goes on", async () => {
    const harness = setup({
      prsByRepository: { 10: [createPr(1), createPr(2)] },
      pullsGet: vi
        .fn()
        .mockRejectedValueOnce(githubError(502))
        .mockResolvedValueOnce(githubPull()),
    });

    const [report] = await run(harness);

    expect(report).toMatchObject({
      status: "incomplete",
      failed: 1,
      written: 1,
    });
    expect(harness.partialUpdateByKey).not.toHaveBeenCalled();
  });

  it("counts a document deleted since it was listed", async () => {
    const harness = setup({
      prsByRepository: { 10: [createPr(1)] },
      partialUpdateOne: vi.fn(() => Promise.reject(new NotFoundError())),
    });

    const [report] = await run(harness);

    expect(report).toMatchObject({
      status: "complete",
      deletedMeanwhile: 1,
      written: 0,
    });
  });

  it("restricts the run to the given repository", async () => {
    const harness = setup({
      repositories: [createRepository(10), createRepository(11)],
    });

    const reports = await run(harness, { repositoryId: 11 });

    expect(reports.map(({ repositoryId }) => repositoryId)).toEqual([11]);
  });
});
