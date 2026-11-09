import type {
  BranchPullRequest,
  BranchPullRequestCandidate,
  ReviewflowLookupResult,
} from "@reviewflow/sdk";

/**
 * reviewflow's newest pull request of a branch as a candidate to prove this
 * local branch's, when it is merged or closed. Null otherwise: an open one is
 * GitHub's list's, and a null state is a pull request closed before reviewflow
 * recorded merges. reviewflow keeps no merge date apart from the close, and no
 * commits: only the head proves the branch's.
 */
export const settledCandidateOf = (
  result: ReviewflowLookupResult,
): BranchPullRequestCandidate | null => {
  if (!result.found) return null;
  const { pr } = result;
  if (pr.headSha === null) return null;
  const state = ((): BranchPullRequest["state"] | null => {
    if (pr.state === "merged") return "MERGED";
    if (pr.state === "closed") return "CLOSED";
    return null;
  })();
  if (state === null) return null;
  return {
    number: pr.number,
    title: pr.title,
    state,
    isDraft: false,
    sha: pr.headSha,
    baseRefName: pr.baseRef ?? "",
    author: pr.author,
    updatedAt: pr.updatedAt,
    mergedAt: state === "MERGED" ? pr.closedAt : null,
    closedAt: pr.closedAt,
    commitOids: [],
  };
};
