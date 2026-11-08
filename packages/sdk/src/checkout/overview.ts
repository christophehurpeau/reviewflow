import type { BranchDiffBase } from "../diff/types.ts";
import type { IsoDateTime } from "../types/ids.ts";
import type { CheckoutStatus } from "./sync.ts";

/** One working tree of a repository, as `git worktree list` names it. */
export interface CheckoutWorktree {
  path: string;
  /** the first one listed: the checkout the repository's `.git` lives in; none in a bare repository */
  main: boolean;
  /** null on a detached HEAD */
  branch: string | null;
  /** null on a branch with no commit yet */
  headSha: string | null;
  /** why it is locked, `""` when no reason was given; null when it is not */
  lock: string | null;
  /** its directory is gone: `git worktree prune` would drop it */
  prunable: boolean;
  /** null when prunable, or when git could not read it */
  status: CheckoutStatus | null;
}

/** A local branch and where it stands. */
export interface CheckoutBranch {
  name: string;
  sha: string;
  /** e.g. `origin/feat`; null when it tracks nothing */
  upstream: string | null;
  /** null without an upstream, or when it is gone */
  ahead: number | null;
  behind: number | null;
  /** the upstream it tracks no longer exists, as after GitHub deleted a merged head */
  upstreamGone: boolean;
  /**
   * Every commit of it is in the base, so deleting it loses nothing; never the
   * base branch itself, which a local copy behind its remote would otherwise
   * be. A squash or rebase merge leaves it unmerged: `upstreamGone` is the
   * sign then.
   */
  merged: boolean;
  /** the worktree it is checked out in; null when none */
  worktreePath: string | null;
  lastCommit: { subject: string; committedAt: IsoDateTime };
}

/** `GET /api/repos/branches?repo=<owner/repo>` — read from git alone, no network. */
export interface CheckoutBranchesResponse {
  /** what `merged` is against; null when it cannot be found, no branch is then merged */
  base: BranchDiffBase | null;
  worktrees: CheckoutWorktree[];
  /** most recently committed first */
  branches: CheckoutBranch[];
}

/** An open pull request of a repository. */
export interface OpenPullRequest {
  number: number;
  title: string;
  isDraft: boolean;
  headRefName: string;
  /** the head's repository, a fork's included; null when it was deleted */
  headOwnerRepo: string | null;
  /** null for a deleted account */
  author: string | null;
  updatedAt: IsoDateTime;
}

/** `GET /api/repos/pulls?repo=<owner/repo>` — the open pull requests, most recently updated first. */
export interface OpenPullRequestsResponse {
  pullRequests: OpenPullRequest[];
  /** every open pull request, the unlisted ones included */
  totalCount: number;
}

const sameRepo = (left: string | null, right: string): boolean =>
  left !== null && left.toLowerCase() === right.toLowerCase();

/** The open pull request whose head is this branch of this repository, not a fork's namesake. */
export const pullRequestOfBranch = (
  pullRequests: OpenPullRequest[],
  ownerRepo: string,
  branch: string,
): OpenPullRequest | null =>
  pullRequests.find(
    (pullRequest) =>
      pullRequest.headRefName === branch &&
      sameRepo(pullRequest.headOwnerRepo, ownerRepo),
  ) ?? null;

/** The open pull requests no local branch is the head of: a fork's, or a branch never checked out. */
export const pullRequestsWithoutBranch = (
  pullRequests: OpenPullRequest[],
  ownerRepo: string,
  branches: CheckoutBranch[],
): OpenPullRequest[] => {
  const names = new Set(branches.map(({ name }) => name));
  return pullRequests.filter(
    (pullRequest) =>
      !names.has(pullRequest.headRefName) ||
      !sameRepo(pullRequest.headOwnerRepo, ownerRepo),
  );
};
