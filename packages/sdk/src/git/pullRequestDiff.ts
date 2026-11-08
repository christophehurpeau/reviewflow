import type { PullRequestRef } from "../api/pullRequest.ts";
import { diffPaths } from "../diff/diffPaths.ts";
import type {
  DiffStep,
  DiffWhitespace,
  PullRequestDiffResponse,
} from "../diff/types.ts";
import { fetchCompareDiff } from "../github/fetchCompareDiff.ts";
import type { GitHubTransport } from "../github/transport.ts";
import {
  groupDiffPaths,
  noPackages,
  packagesAtTree,
} from "./groupDiffPaths.ts";
import type { IsPackage } from "./groupDiffPaths.ts";
import { readBranchDiff } from "./readBranchDiff.ts";
import { git, gitOrNull } from "./run.ts";

export const isSha = (value: string): boolean => /^[\da-f]{40}$/i.test(value);

const hasCommit = async (checkout: string, sha: string): Promise<boolean> =>
  (await gitOrNull(checkout, ["cat-file", "-e", `${sha}^{commit}`])) !== null;

/**
 * Fetches the commits the checkout lacks, by sha: GitHub serves a pull
 * request's head that way even when no branch of the user's names it.
 * Objects only — `--no-write-fetch-head` and a refspec with no destination
 * leave every ref and `FETCH_HEAD` as they were, so whatever works in the
 * checkout sees nothing move. Nothing is asked when both are already there,
 * the common case for the user's own pull request.
 */
export const ensureCommits = async (
  checkout: string,
  shas: string[],
  onStep: ((step: DiffStep) => void) | undefined,
  signal?: AbortSignal,
): Promise<void> => {
  const missing: string[] = [];
  for (const sha of shas) {
    if (!(await hasCommit(checkout, sha))) missing.push(sha);
  }
  if (missing.length === 0) return;
  onStep?.("fetching");
  await git(
    checkout,
    ["fetch", "--no-write-fetch-head", "--no-tags", "origin", ...missing],
    { network: true, ...(signal === undefined ? {} : { signal }) },
  );
};

export interface PullRequestDiffRequest {
  /** the registered checkout, resolved by the caller; null when there is none */
  checkout: string | null;
  transport: GitHubTransport;
  ref: PullRequestRef;
  head: string;
  base: string;
  /** `show` unless set */
  whitespace?: DiffWhitespace;
  /** called with "fetching" before a fetch that runs, and "diffing" before the diff */
  onStep?: (step: DiffStep) => void;
  /** the reader left: the fetch is killed and GitHub is not asked instead */
  signal?: AbortSignal;
}

const readFromGit = async (
  checkout: string,
  { head, base, whitespace = "show", onStep, signal }: PullRequestDiffRequest,
): Promise<PullRequestDiffResponse> => {
  await ensureCommits(checkout, [head, base], onStep, signal);
  onStep?.("diffing");
  const mergeBaseOutput = await git(checkout, ["merge-base", base, head]);
  const mergeBase = mergeBaseOutput.trim();
  const { patch, paths, omitted } = await readBranchDiff({
    cwd: checkout,
    mergeBase,
    scope: "committed",
    head,
    whitespace,
  });
  return {
    source: "git",
    fallbackReason: null,
    whitespace,
    patch,
    sides: { old: mergeBase, new: head },
    omitted,
    groups: groupDiffPaths(await packagesAtTree(checkout, head), paths),
  };
};

/**
 * The compare endpoint rather than the pull request's own diff: it takes any
 * range. Three dots, from the merge base, as the local path does. Grouped by
 * the head's manifests when a checkout holds the head, else by first directory.
 */
const readFromGitHub = async (
  { checkout, transport, ref, head, base }: PullRequestDiffRequest,
  fallbackReason: string,
): Promise<PullRequestDiffResponse> => {
  const patch = await fetchCompareDiff(transport, {
    ownerRepo: ref.ownerRepo,
    base,
    head,
  });
  let isPackage: IsPackage = noPackages;
  if (checkout !== null) {
    // the head may be absent from the checkout (that is a reason to be here)
    isPackage = await packagesAtTree(checkout, head).catch(() => noPackages);
  }
  return {
    source: "github",
    fallbackReason,
    whitespace: "show",
    patch,
    sides: null,
    omitted: [],
    groups: groupDiffPaths(isPackage, diffPaths(patch)),
  };
};

/**
 * Local git first, for its size bounds and no file cap, over any range of two
 * commits; GitHub's compare endpoint only when there is no checkout or git
 * fails — and the reason travels with the answer, so a fallback is never
 * silent: "no checkout" when none was given, git's own message otherwise.
 */
export const readPullRequestDiff = async (
  request: PullRequestDiffRequest,
): Promise<PullRequestDiffResponse> => {
  if (!isSha(request.head) || !isSha(request.base)) {
    throw new Error("head and base must be commit shas");
  }
  if (request.checkout === null) return readFromGitHub(request, "no checkout");
  try {
    return await readFromGit(request.checkout, request);
  } catch (error: unknown) {
    if (request.signal?.aborted) throw error;
    const reason = error instanceof Error ? error.message : String(error);
    return readFromGitHub(request, reason);
  }
};

/**
 * `cat-file blob` rather than `show`: the bytes as committed, with no textconv
 * or filter, which is what the patch's lines were read from. The commits are
 * already in the checkout, fetched when its diff was read.
 */
export const readFileAtSha = async (
  checkout: string,
  sha: string,
  path: string,
): Promise<string> => {
  if (!isSha(sha)) throw new Error("sha must be a commit sha");
  if (path === "") throw new Error("path is required");
  return git(checkout, ["cat-file", "blob", `${sha}:${path}`], {
    maxBuffer: 64 * 1024 * 1024,
  });
};
