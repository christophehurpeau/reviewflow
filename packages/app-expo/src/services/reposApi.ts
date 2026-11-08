import type {
  BranchDiffScope,
  CheckoutBranchDiffResponse,
  CheckoutReposResponse,
  DiffWhitespace,
} from "@reviewflow/sdk";
import type { UseQueryResult } from "@tanstack/react-query";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getJson } from "./api.ts";

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
  });
