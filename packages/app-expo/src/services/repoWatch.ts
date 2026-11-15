import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { CheckoutRef } from "./reposApi.ts";
import { invalidateRepo } from "./reposApi.ts";
import { serverBaseUrl } from "./serverBaseUrl.ts";

const watchUrl = ({ ownerRepo, worktree }: CheckoutRef): string => {
  const query = new URLSearchParams({
    repo: ownerRepo,
    ...(worktree === null ? {} : { worktree }),
  });
  return `${serverBaseUrl()}/api/repos/watch?${query.toString()}`;
};

/**
 * Re-reads what a change moved, as the server reports it: a ref or a HEAD
 * (`git`: a commit, a checkout, a fetch) moves every read of the repository;
 * a file (`files`) moves what the watched checkout holds. Only the mounted
 * reads run again, the others when shown. The statuses of the other worktrees
 * are left alone on a file change: re-reading them costs a git call each.
 */
export const useRepoWatch = (checkout: CheckoutRef | null): void => {
  const client = useQueryClient();
  const ownerRepo = checkout?.ownerRepo ?? null;
  const worktree = checkout?.worktree ?? null;

  useEffect(() => {
    if (ownerRepo === null || typeof EventSource === "undefined") return;
    const source = new EventSource(watchUrl({ ownerRepo, worktree }));
    const invalidate = (queryKey: unknown[]): void => {
      client.invalidateQueries({ queryKey }).catch(() => undefined);
    };
    source.addEventListener("git", () => {
      invalidateRepo(client, ownerRepo).catch(() => undefined);
      invalidate(["repoFiles", ownerRepo]);
    });
    source.addEventListener("files", () => {
      invalidate(["repoStatus", ownerRepo, worktree]);
      invalidate(["repoDiff", ownerRepo, worktree]);
      invalidate(["repoFiles", ownerRepo, worktree]);
    });
    return () => {
      source.close();
    };
  }, [client, ownerRepo, worktree]);
};
