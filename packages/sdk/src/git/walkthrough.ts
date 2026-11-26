import type { DiffOmittedFile } from "../diff/types.ts";
import { annotatePatch } from "../diff/walkthrough.ts";
import { ensureCommits, isSha } from "./pullRequestDiff.ts";
import { readBranchDiff } from "./readBranchDiff.ts";
import { git } from "./run.ts";

export interface WalkthroughDiffRequest {
  /** the registered checkout, resolved by the caller */
  checkout: string;
  head: string;
  base: string;
}

export interface WalkthroughDiff {
  head: string;
  base: string;
  mergeBase: string;
  /** whitespace shown: the diff hunk ids are counted in */
  patch: string;
  /** `patch` with a `### hunk <id>` line before each hunk, for the writer */
  annotatedPatch: string;
  omitted: DiffOmittedFile[];
}

/**
 * The diff a walkthrough is written on and checked against: the range
 * `/api/prs/diff` reads (head against its merge base with base), from local
 * git only, whitespace shown. The commits are fetched by sha when the
 * checkout lacks them.
 */
export const readWalkthroughDiff = async ({
  checkout,
  head,
  base,
}: WalkthroughDiffRequest): Promise<WalkthroughDiff> => {
  if (!isSha(head) || !isSha(base)) {
    throw new Error("head and base must be commit shas");
  }
  await ensureCommits(checkout, [head, base], undefined);
  const mergeBaseOutput = await git(checkout, ["merge-base", base, head]);
  const mergeBase = mergeBaseOutput.trim();
  const { patch, omitted } = await readBranchDiff({
    cwd: checkout,
    mergeBase,
    scope: "committed",
    head,
    whitespace: "show",
  });
  return {
    head,
    base,
    mergeBase,
    patch,
    annotatedPatch: annotatePatch(patch),
    omitted,
  };
};
