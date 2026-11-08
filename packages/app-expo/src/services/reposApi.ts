import type {
  BranchDiffScope,
  CheckoutBranchDiffResponse,
  CheckoutCommitsResponse,
  CheckoutReposResponse,
  CheckoutSyncResponse,
  CommitDiffResponse,
  DiffWhitespace,
  RepoPathSuggestionsResponse,
} from "@reviewflow/sdk";
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

interface UseRepoDiffParams {
  ownerRepo: string;
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
  ownerRepo,
  scope,
  whitespace,
  enabled,
}: UseRepoDiffParams): UseQueryResult<CheckoutBranchDiffResponse> =>
  useQuery({
    queryKey: ["repoDiff", ownerRepo, scope, whitespace],
    queryFn: ({ signal }) =>
      getJson<CheckoutBranchDiffResponse>(
        "/api/repos/diff",
        { repo: ownerRepo, scope, whitespace },
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
  ownerRepo: string,
): UseQueryResult<CheckoutCommitsResponse> =>
  useQuery({
    queryKey: ["repoCommits", ownerRepo],
    queryFn: ({ signal }) =>
      getJson<CheckoutCommitsResponse>(
        "/api/repos/commits",
        { repo: ownerRepo },
        signal,
      ),
  });

interface UseCommitDiffParams {
  ownerRepo: string;
  /** null: no commit is open, nothing is read */
  sha: string | null;
  whitespace: DiffWhitespace;
}

/** One commit against its first parent; a commit never changes, so its answer stays. */
export const useCommitDiff = ({
  ownerRepo,
  sha,
  whitespace,
}: UseCommitDiffParams): UseQueryResult<CommitDiffResponse> =>
  useQuery({
    queryKey: ["repoCommit", ownerRepo, sha, whitespace],
    queryFn: ({ signal }) =>
      getJson<CommitDiffResponse>(
        "/api/repos/commit",
        { repo: ownerRepo, sha: sha ?? "", whitespace },
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
  ownerRepo: string,
  source: "fetched" | "local",
): UseQueryResult<CheckoutSyncResponse> =>
  useQuery({
    queryKey: ["repoStatus", ownerRepo, source],
    queryFn: ({ signal }) =>
      getJson<CheckoutSyncResponse>(
        "/api/repos/status",
        source === "fetched"
          ? { repo: ownerRepo, fetch: "1" }
          : { repo: ownerRepo },
        signal,
      ),
  });

export const syncRepo = async (
  action: "pull" | "push",
  ownerRepo: string,
): Promise<void> => {
  await postJson(
    `/api/repos/${action}?${new URLSearchParams({ repo: ownerRepo })}`,
    {},
  );
};

/** What a pull or a push moves: the checkout's status, its diff, its commits and its row. */
export const invalidateRepo = async (
  client: QueryClient,
  ownerRepo: string,
): Promise<void> => {
  await Promise.all([
    client.invalidateQueries({ queryKey: ["repoStatus", ownerRepo] }),
    client.invalidateQueries({ queryKey: ["repoDiff", ownerRepo] }),
    client.invalidateQueries({ queryKey: ["repoCommits", ownerRepo] }),
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
