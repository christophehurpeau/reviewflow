import type {
  BranchPullRequest,
  BranchPullRequestCandidate,
} from "../checkout/overview.ts";
import { readCommit, readDefaultBranch } from "./checkoutBranchDiff.ts";
import { gitOrNull } from "./run.ts";

const isAncestor = async (
  cwd: string,
  ancestor: string,
  descendant: string,
): Promise<boolean> =>
  (await gitOrNull(cwd, [
    "merge-base",
    "--is-ancestor",
    ancestor,
    descendant,
  ])) !== null;

/** The first of `names` found as a remote-tracking branch, else as a local one. */
const readBaseSha = async (
  cwd: string,
  names: string[],
): Promise<string | null> => {
  for (const name of names) {
    for (const ref of [`refs/remotes/origin/${name}`, `refs/heads/${name}`]) {
      const sha = await readCommit(cwd, ref);
      if (sha !== null) return sha;
    }
  }
  return null;
};

interface OwnWorkParams {
  cwd: string;
  tip: string;
  defaultBranch: string;
  pullRequest: BranchPullRequestCandidate;
}

/**
 * A merged or closed pull request whose head commit is in the base's history
 * (a merge commit) is in every branch later cut from that base: sharing
 * history is no proof then, only sharing commits the base does not have.
 */
const sharesOwnCommits = async ({
  cwd,
  tip,
  defaultBranch,
  pullRequest,
}: OwnWorkParams): Promise<boolean> => {
  if ((await readCommit(cwd, pullRequest.sha)) === null) return false;
  const base = await readBaseSha(cwd, [
    ...new Set([pullRequest.baseRefName, defaultBranch]),
  ]);
  if (base === null) return false;
  const mergeBase = await gitOrNull(cwd, ["merge-base", tip, pullRequest.sha]);
  if (mergeBase === null) return false;
  return !(await isAncestor(cwd, mergeBase.trim(), base));
};

const isOwnWork = async (params: OwnWorkParams): Promise<boolean> => {
  const { tip, pullRequest } = params;
  if (pullRequest.state === "OPEN") return true;
  if (pullRequest.sha === tip || pullRequest.commitOids.includes(tip)) {
    return true;
  }
  return sharesOwnCommits(params);
};

export interface LinkBranchPullRequestsParams {
  cwd: string;
  branch: string;
  pullRequests: BranchPullRequestCandidate[];
}

/**
 * The pull requests of the branch's name that are this local branch's, in
 * their order. An open one is, as on the repository's list: only one branch
 * holds the name on GitHub now. A merged or closed one is when the local tip
 * is one of its commits (read from GitHub, so the commits need not have been
 * fetched), or when both share commits of their own that the pull request's
 * base does not have: a branch cut from the base under a reused name shares
 * none. Known limitation: a branch kept and continued after a merge-commit
 * merge loses that pull request, its commits now being the base's.
 */
export const linkBranchPullRequests = async ({
  cwd,
  branch,
  pullRequests,
}: LinkBranchPullRequestsParams): Promise<BranchPullRequest[]> => {
  const tip = await readCommit(cwd, `refs/heads/${branch}`);
  if (tip === null) throw new Error(`no local branch ${branch} in ${cwd}`);
  const defaultBranch = (await readDefaultBranch(cwd)) ?? "main";
  const owned = await Promise.all(
    pullRequests.map((pullRequest) =>
      isOwnWork({ cwd, tip, defaultBranch, pullRequest }),
    ),
  );
  return pullRequests
    .filter((_, index) => owned[index])
    .map(({ commitOids: _commitOids, ...pullRequest }) => pullRequest);
};
