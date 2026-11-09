import type {
  BranchDiffScope,
  BranchPullRequestsResponse,
  CheckoutBranchDiffResponse,
  CheckoutBranchesResponse,
  CheckoutCommitsResponse,
  CheckoutReposResponse,
  CheckoutSyncResponse,
  CommitDiffResponse,
  DiffWhitespace,
  OpenPullRequestsResponse,
  RepoPathSuggestionsResponse,
  SettledBranchPullRequestsResponse,
  WorktreeRemovalRequest,
  WorktreeRemovalResult,
  WorktreeRemovalStatusResponse,
} from "@reviewflow/sdk";
import type { WorktreeRemovalCheck } from "@reviewflow/ui";
import type { QueryClient, UseQueryResult } from "@tanstack/react-query";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getJson, postJson } from "./api.ts";

export const reposQueryKey = ["repos"] as const;

/** Every configured checkout and the branch it has out, read again on each visit. */
export const useRepos = (): UseQueryResult<CheckoutReposResponse> =>
  useQuery({
    queryKey: reposQueryKey,
    queryFn: () => getJson<CheckoutReposResponse>("/api/repos"),
    refetchOnMount: "always",
  });

/** A listed checkout, or one of its worktrees: what every checkout read names. */
export interface CheckoutRef {
  ownerRepo: string;
  /** a path `git worktree list` gave; null: the listed checkout itself */
  worktree: string | null;
  /**
   * A local branch read in place of the checkout's HEAD, by the diff and the
   * commits only: it has no working tree, status or sync of its own.
   */
  branch?: string;
}

const checkoutQuery = ({
  ownerRepo,
  worktree,
  branch,
}: CheckoutRef): Record<string, string> => ({
  repo: ownerRepo,
  ...(worktree === null ? {} : { worktree }),
  ...(branch === undefined ? {} : { branch }),
});

interface UseRepoDiffParams {
  checkout: CheckoutRef;
  scope: BranchDiffScope;
  whitespace: DiffWhitespace;
  /** false while another tab is shown: nothing is read for it */
  enabled: boolean;
}

/**
 * The checked-out branch against its base, or the working tree against HEAD.
 * Keyed by what decides the patch; the previous answer stays while the next is
 * read, so a whitespace toggle does not blank a long diff.
 */
export const useRepoDiff = ({
  checkout,
  scope,
  whitespace,
  enabled,
}: UseRepoDiffParams): UseQueryResult<CheckoutBranchDiffResponse> =>
  useQuery({
    queryKey: [
      "repoDiff",
      checkout.ownerRepo,
      checkout.worktree,
      checkout.branch ?? null,
      scope,
      whitespace,
    ],
    queryFn: ({ signal }) =>
      getJson<CheckoutBranchDiffResponse>(
        "/api/repos/diff",
        { ...checkoutQuery(checkout), scope, whitespace },
        signal,
      ),
    placeholderData: keepPreviousData,
    enabled,
  });

/**
 * The last commits of HEAD, newest first: read with the screen, since the
 * branch's commit count and its base head every tab.
 */
export const useRepoCommits = (
  checkout: CheckoutRef,
): UseQueryResult<CheckoutCommitsResponse> =>
  useQuery({
    queryKey: [
      "repoCommits",
      checkout.ownerRepo,
      checkout.worktree,
      checkout.branch ?? null,
    ],
    queryFn: ({ signal }) =>
      getJson<CheckoutCommitsResponse>(
        "/api/repos/commits",
        checkoutQuery(checkout),
        signal,
      ),
  });

interface UseCommitDiffParams {
  checkout: CheckoutRef;
  /** null: no commit is open, nothing is read */
  sha: string | null;
  whitespace: DiffWhitespace;
}

/** One commit against its first parent; a commit never changes, so its answer stays. */
export const useCommitDiff = ({
  checkout,
  sha,
  whitespace,
}: UseCommitDiffParams): UseQueryResult<CommitDiffResponse> =>
  useQuery({
    queryKey: ["repoCommit", checkout.ownerRepo, sha, whitespace],
    queryFn: ({ signal }) =>
      getJson<CommitDiffResponse>(
        "/api/repos/commit",
        { ...checkoutQuery(checkout), sha: sha ?? "", whitespace },
        signal,
      ),
    enabled: sha !== null,
    staleTime: Infinity,
  });

/**
 * The checkout's status. `fetched`: fetched first so Pull counts what the
 * remote has now, one network call when the screen opens and on each reload.
 * `local`: as of the last fetch, answered at once.
 */
export const useRepoStatus = (
  checkout: CheckoutRef,
  source: "fetched" | "local",
): UseQueryResult<CheckoutSyncResponse> =>
  useQuery({
    queryKey: ["repoStatus", checkout.ownerRepo, checkout.worktree, source],
    queryFn: ({ signal }) =>
      getJson<CheckoutSyncResponse>(
        "/api/repos/status",
        source === "fetched"
          ? { ...checkoutQuery(checkout), fetch: "1" }
          : checkoutQuery(checkout),
        signal,
      ),
  });

/** The local branches and the worktrees, from git alone. */
export const useRepoBranches = (
  ownerRepo: string,
): UseQueryResult<CheckoutBranchesResponse> =>
  useQuery({
    queryKey: ["repoBranches", ownerRepo],
    queryFn: ({ signal }) =>
      getJson<CheckoutBranchesResponse>(
        "/api/repos/branches",
        { repo: ownerRepo },
        signal,
      ),
  });

/** The repository's open pull requests, from GitHub: one request. */
export const useRepoPulls = (
  ownerRepo: string,
): UseQueryResult<OpenPullRequestsResponse> =>
  useQuery({
    queryKey: ["repoPulls", ownerRepo],
    queryFn: ({ signal }) =>
      getJson<OpenPullRequestsResponse>(
        "/api/repos/pulls",
        { repo: ownerRepo },
        signal,
      ),
  });

/** The merged or closed pull request of each local branch, from reviewflow: one request, nothing asked without a token. */
export const useRepoSettledPulls = (
  ownerRepo: string,
): UseQueryResult<SettledBranchPullRequestsResponse> =>
  useQuery({
    queryKey: ["repoSettledPulls", ownerRepo],
    queryFn: ({ signal }) =>
      getJson<SettledBranchPullRequestsResponse>(
        "/api/repos/settled-pulls",
        { repo: ownerRepo },
        signal,
      ),
  });

/**
 * A local branch's pull requests, open, merged or closed, from GitHub: one
 * request. Idle without a branch, as on a detached HEAD.
 */
export const useBranchPulls = (
  ownerRepo: string,
  branch: string | null,
): UseQueryResult<BranchPullRequestsResponse> =>
  useQuery({
    queryKey: ["branchPulls", ownerRepo, branch],
    queryFn: ({ signal }) =>
      getJson<BranchPullRequestsResponse>(
        "/api/repos/branch-pulls",
        { repo: ownerRepo, branch: branch ?? "" },
        signal,
      ),
    enabled: branch !== null,
  });

/** GitHub is read again only when the reader asks: a reload, never a pull or a push. */
export const invalidateBranchPulls = async (
  client: QueryClient,
  ownerRepo: string,
): Promise<void> => {
  await client.invalidateQueries({ queryKey: ["branchPulls", ownerRepo] });
};

export const syncRepo = async (
  action: "pull" | "push",
  checkout: CheckoutRef,
): Promise<void> => {
  await postJson(
    `/api/repos/${action}?${new URLSearchParams(checkoutQuery(checkout))}`,
    {},
  );
};

/**
 * What removing the worktree would lose, read again on every confirmation. A
 * merged pull request of its branch marks the branch spent.
 */
export const readWorktreeRemovalCheck = async (
  checkout: CheckoutRef,
): Promise<WorktreeRemovalCheck> => {
  const answer = await getJson<WorktreeRemovalStatusResponse>(
    "/api/repos/worktree-status",
    checkoutQuery(checkout),
  );
  return {
    status: answer.status,
    branchSpent: answer.pullRequests.some(({ state }) => state === "MERGED"),
    notice:
      answer.pullRequestsError === null
        ? null
        : `GitHub could not be read (${answer.pullRequestsError}): no pull request proves a commit pushed.`,
  };
};

/** Answered once git removed it; the server's refusal is the error. */
export const removeWorktree = (
  checkout: CheckoutRef,
  deleteBranch: boolean,
): Promise<WorktreeRemovalResult> => {
  const request: WorktreeRemovalRequest = { deleteBranch };
  return postJson<WorktreeRemovalResult>(
    `/api/repos/worktree-remove?${new URLSearchParams(checkoutQuery(checkout))}`,
    request,
  );
};

/**
 * What a pull, a push or a reload moves: every read of the repository's
 * checkouts, its branches and its row.
 */
export const invalidateRepo = async (
  client: QueryClient,
  ownerRepo: string,
): Promise<void> => {
  await Promise.all([
    client.invalidateQueries({ queryKey: ["repoStatus", ownerRepo] }),
    client.invalidateQueries({ queryKey: ["repoDiff", ownerRepo] }),
    client.invalidateQueries({ queryKey: ["repoCommits", ownerRepo] }),
    client.invalidateQueries({ queryKey: ["repoBranches", ownerRepo] }),
    client.invalidateQueries({ queryKey: reposQueryKey }),
  ]);
};

/** Scans the repositories folders again, past the server's cache, and shows the answer. */
export const refreshRepos = async (client: QueryClient): Promise<void> => {
  const answer = await getJson<CheckoutReposResponse>("/api/repos", {
    refresh: "1",
  });
  client.setQueryData(reposQueryKey, answer);
};

/** The folders of the home directory holding checkouts that `repoPaths` does not list. */
export const readRepoPathSuggestions =
  (): Promise<RepoPathSuggestionsResponse> =>
    getJson<RepoPathSuggestionsResponse>("/api/config/repo-paths/suggestions");
