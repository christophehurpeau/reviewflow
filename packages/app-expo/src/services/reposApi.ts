import type {
  BranchDiffScope,
  CheckoutBranchDiffResponse,
  CheckoutCommitsResponse,
  CheckoutReposResponse,
  CheckoutSyncResponse,
  CommitDiffResponse,
  DiffWhitespace,
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
 * The checked-out branch against its base. Keyed by what decides the patch;
 * the previous answer stays while the next is read, so a scope switch does not
 * blank a long diff.
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

/** The last commits of HEAD, newest first, read when the tab opens. */
export const useRepoCommits = (
  ownerRepo: string,
  enabled: boolean,
): UseQueryResult<CheckoutCommitsResponse> =>
  useQuery({
    queryKey: ["repoCommits", ownerRepo],
    queryFn: ({ signal }) =>
      getJson<CheckoutCommitsResponse>(
        "/api/repos/commits",
        { repo: ownerRepo },
        signal,
      ),
    enabled,
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
 * The checkout's status, fetched first so Pull counts what the remote has now:
 * one network call when the screen opens, and on each reload.
 */
export const useRepoStatus = (
  ownerRepo: string,
): UseQueryResult<CheckoutSyncResponse> =>
  useQuery({
    queryKey: ["repoStatus", ownerRepo],
    queryFn: ({ signal }) =>
      getJson<CheckoutSyncResponse>(
        "/api/repos/status",
        { repo: ownerRepo, fetch: "1" },
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
