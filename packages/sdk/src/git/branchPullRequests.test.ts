import { afterEach, describe, expect, it } from "vitest";
import type { BranchPullRequestCandidate } from "../checkout/overview.ts";
import { linkBranchPullRequests } from "./branchPullRequests.ts";
import type { GitRepoFixture } from "./test/gitRepo.ts";
import { createGitRepo } from "./test/gitRepo.ts";

let repo: GitRepoFixture | undefined;

afterEach(() => {
  repo?.remove();
  repo = undefined;
});

const unknownSha = "0123456789abcdef0123456789abcdef01234567";

const candidate = (
  overrides: Partial<BranchPullRequestCandidate>,
): BranchPullRequestCandidate => ({
  number: 1,
  title: "feat: x",
  state: "MERGED",
  isDraft: false,
  sha: unknownSha,
  baseRefName: "main",
  author: "octocat",
  updatedAt: "2026-11-08T10:00:00.000Z",
  mergedAt: "2026-11-08T10:00:00.000Z",
  closedAt: "2026-11-08T10:00:00.000Z",
  commitOids: [],
  ...overrides,
});

const shaOf = (fixture: GitRepoFixture, ref: string): string =>
  fixture.git(["rev-parse", ref]).trim();

let commitCount = 0;

/** The fixture's commits are identical within a second, sharing a sha: each message here is distinct. */
const commit = (fixture: GitRepoFixture): void => {
  commitCount += 1;
  fixture.git([
    "commit",
    "--allow-empty",
    "--quiet",
    "-m",
    `chore: commit ${String(commitCount)}`,
  ]);
};

/** `feature` cut from `from` with two commits, its tip returned; `main` checked out again. */
const createFeature = (fixture: GitRepoFixture, from = "main"): string => {
  fixture.git(["switch", "--quiet", "-c", "feature", from]);
  commit(fixture);
  commit(fixture);
  const tip = shaOf(fixture, "HEAD");
  fixture.git(["switch", "--quiet", from]);
  return tip;
};

/** The name reused: `feature` deleted, cut again from `from` with one commit. */
const recreateFeature = (fixture: GitRepoFixture, from = "main"): void => {
  fixture.git(["branch", "--quiet", "-D", "feature"]);
  fixture.git(["switch", "--quiet", "-c", "feature", from]);
  commit(fixture);
  fixture.git(["switch", "--quiet", from]);
};

const linkedNumbers = async (
  fixture: GitRepoFixture,
  pullRequests: BranchPullRequestCandidate[],
): Promise<number[]> => {
  const linked = await linkBranchPullRequests({
    cwd: fixture.path,
    branch: "feature",
    pullRequests,
  });
  return linked.map(({ number }) => number);
};

describe("linkBranchPullRequests", () => {
  it("links an open pull request by name, its head unknown or diverged", async () => {
    repo = createGitRepo();
    createFeature(repo);
    expect(
      await linkedNumbers(repo, [candidate({ number: 7, state: "OPEN" })]),
    ).toEqual([7]);
  });

  it("links a merged pull request whose head is the tip, without its commits listed", async () => {
    repo = createGitRepo();
    const head = createFeature(repo);
    commit(repo);
    repo.git(["merge", "--quiet", "--no-ff", "-m", "merge", "feature"]);
    expect(await linkedNumbers(repo, [candidate({ sha: head })])).toEqual([1]);
  });

  it("links a merged pull request the branch is behind, its head never fetched", async () => {
    repo = createGitRepo();
    const tip = createFeature(repo);
    expect(
      await linkedNumbers(repo, [candidate({ commitOids: [tip, unknownSha] })]),
    ).toEqual([1]);
    expect(await linkedNumbers(repo, [candidate({})])).toEqual([]);
  });

  it("links a squash-merged pull request the branch went on from", async () => {
    repo = createGitRepo();
    const head = createFeature(repo);
    commit(repo);
    repo.git(["switch", "--quiet", "feature"]);
    commit(repo);
    repo.git(["switch", "--quiet", "main"]);
    expect(await linkedNumbers(repo, [candidate({ sha: head })])).toEqual([1]);
  });

  it("links a squash-merged pull request that diverged from the branch", async () => {
    repo = createGitRepo();
    const shared = createFeature(repo);
    repo.git(["switch", "--quiet", "-c", "remote-head", shared]);
    commit(repo);
    const head = shaOf(repo, "HEAD");
    repo.git(["switch", "--quiet", "feature"]);
    commit(repo);
    repo.git(["switch", "--quiet", "main"]);
    repo.git(["branch", "--quiet", "-D", "remote-head"]);
    expect(await linkedNumbers(repo, [candidate({ sha: head })])).toEqual([1]);
  });

  it("leaves out an older pull request of a reused name, merged with a merge commit", async () => {
    repo = createGitRepo();
    const head = createFeature(repo);
    repo.git(["merge", "--quiet", "--no-ff", "-m", "merge", "feature"]);
    recreateFeature(repo);
    expect(await linkedNumbers(repo, [candidate({ sha: head })])).toEqual([]);
  });

  it("leaves out an older pull request of a reused name, squash-merged", async () => {
    repo = createGitRepo();
    const head = createFeature(repo);
    commit(repo);
    recreateFeature(repo);
    expect(await linkedNumbers(repo, [candidate({ sha: head })])).toEqual([]);
  });

  it("judges a merge commit against the pull request's own base, not the default branch", async () => {
    repo = createGitRepo();
    repo.git(["branch", "--quiet", "develop"]);
    const head = createFeature(repo, "develop");
    repo.git(["switch", "--quiet", "develop"]);
    repo.git(["merge", "--quiet", "--no-ff", "-m", "merge", "feature"]);
    recreateFeature(repo, "develop");
    expect(
      await linkedNumbers(repo, [
        candidate({ sha: head, baseRefName: "develop" }),
      ]),
    ).toEqual([]);
  });

  it("keeps their order and drops the commits from the answer", async () => {
    repo = createGitRepo();
    const tip = createFeature(repo);
    const linked = await linkBranchPullRequests({
      cwd: repo.path,
      branch: "feature",
      pullRequests: [
        candidate({ number: 9, state: "OPEN" }),
        candidate({ number: 3, sha: tip, commitOids: [tip] }),
      ],
    });
    expect(linked.map(({ number }) => number)).toEqual([9, 3]);
    expect(linked[1]).not.toHaveProperty("commitOids");
  });

  it("refuses a branch that does not exist", async () => {
    repo = createGitRepo();
    await expect(linkedNumbers(repo, [])).rejects.toThrow(
      "no local branch feature",
    );
  });
});
