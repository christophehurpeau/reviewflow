import type {
  CheckoutFileAtHead,
  CheckoutFileRead,
  CheckoutFileSaveResponse,
  CheckoutFilesResponse,
} from "@reviewflow/sdk";
import type { QueryClient, UseQueryResult } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { getJson, requestJson } from "./api.ts";
import type { CheckoutRef } from "./reposApi.ts";

const checkoutQuery = ({
  ownerRepo,
  worktree,
}: CheckoutRef): Record<string, string> => ({
  repo: ownerRepo,
  ...(worktree === null ? {} : { worktree }),
});

const filesKey = (checkout: CheckoutRef): readonly unknown[] => [
  "repoFiles",
  checkout.ownerRepo,
  checkout.worktree,
];

/** Every file of the working tree and its git state; `enabled` false reads nothing. */
export const useRepoFiles = (
  checkout: CheckoutRef,
  enabled: boolean,
): UseQueryResult<CheckoutFilesResponse> =>
  useQuery({
    queryKey: filesKey(checkout),
    queryFn: ({ signal }) =>
      getJson<CheckoutFilesResponse>(
        "/api/repos/files",
        checkoutQuery(checkout),
        signal,
      ),
    enabled,
  });

/**
 * The open file, read again when the window regains the focus: an outside
 * change (an agent, another editor) is then adopted, or offered as a conflict
 * over unsaved edits — never a silent overwrite either way.
 */
export const useRepoFile = (
  checkout: CheckoutRef,
  path: string | null,
): UseQueryResult<CheckoutFileRead> =>
  useQuery({
    queryKey: [...filesKey(checkout), path],
    queryFn: ({ signal }) =>
      getJson<CheckoutFileRead>(
        "/api/repos/file",
        { ...checkoutQuery(checkout), path: path ?? "" },
        signal,
      ),
    enabled: path !== null,
    refetchOnWindowFocus: "always",
  });

/**
 * The open file as `HEAD` has it, what its draft is diffed against: read only
 * while the diff is shown. Under the files key, so whatever reads the
 * checkout's files again (a commit seen by the watch) reads it again too.
 */
export const useRepoFileAtHead = (
  checkout: CheckoutRef,
  path: string | null,
): UseQueryResult<CheckoutFileAtHead> =>
  useQuery({
    queryKey: [...filesKey(checkout), path, "head"],
    queryFn: ({ signal }) =>
      getJson<CheckoutFileAtHead>(
        "/api/repos/file",
        { ...checkoutQuery(checkout), path: path ?? "", at: "head" },
        signal,
      ),
    enabled: path !== null,
  });

/** Saves the file unless it changed since `expectedSource`; a refusal throws with the server's reason. */
export const saveRepoFile = async (
  client: QueryClient,
  checkout: CheckoutRef,
  path: string,
  source: string,
  expectedSource: string,
): Promise<CheckoutFileSaveResponse> => {
  const result = await requestJson<CheckoutFileSaveResponse>(
    "PUT",
    `/api/repos/file?${new URLSearchParams(checkoutQuery(checkout)).toString()}`,
    { path, source, expectedSource },
  );
  if (result.status === "saved") {
    client.setQueryData<CheckoutFileRead>(
      [...filesKey(checkout), path],
      (previous) =>
        previous?.status === "text"
          ? { ...previous, source: result.source }
          : { status: "text", source: result.source },
    );
    // the diff tabs and the status count what is uncommitted
    await client.invalidateQueries({
      queryKey: ["repoDiff", checkout.ownerRepo],
    });
    await client.invalidateQueries({
      queryKey: ["repoStatus", checkout.ownerRepo],
    });
  }
  return result;
};
