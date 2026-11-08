import type {
  BranchDiffBase,
  BranchDiffScope,
  CheckoutBranchDiffResponse,
  DiffWhitespace,
} from "../diff/types.ts";
import { groupDiffPaths, packagesOnDisk } from "./groupDiffPaths.ts";
import type { DiffLimits } from "./readBranchDiff.ts";
import { readBranchDiff } from "./readBranchDiff.ts";
import { git, gitOrNull } from "./run.ts";

/** null on a detached HEAD */
export const readHeadBranch = async (cwd: string): Promise<string | null> => {
  const branch = await gitOrNull(cwd, [
    "symbolic-ref",
    "--quiet",
    "--short",
    "HEAD",
  ]);
  return branch === null || branch.trim() === "" ? null : branch.trim();
};

export const readHeadSha = async (cwd: string): Promise<string> => {
  const sha = await git(cwd, ["rev-parse", "HEAD"]);
  return sha.trim();
};

/**
 * The branch `origin/HEAD` points at, as the last clone or
 * `git remote set-head` recorded it; null when it was never recorded.
 */
export const readDefaultBranch = async (
  cwd: string,
): Promise<string | null> => {
  const ref = await gitOrNull(cwd, [
    "symbolic-ref",
    "--quiet",
    "--short",
    "refs/remotes/origin/HEAD",
  ]);
  const name = ref?.trim().replace(/^origin\//, "") ?? "";
  return name === "" ? null : name;
};

const readCommit = async (cwd: string, ref: string): Promise<string | null> => {
  const sha = await gitOrNull(cwd, [
    "rev-parse",
    "--verify",
    "--quiet",
    `${ref}^{commit}`,
  ]);
  return sha === null ? null : sha.trim();
};

export interface ResolvedDiffBase {
  base: BranchDiffBase;
  mergeBase: string;
}

/**
 * `origin/<name>` before `<name>`: in a worktree setup the local base branch is
 * whatever was last pulled in the main checkout, usually older than the last
 * fetch. Nothing is fetched: a read that talks to the network on every open is
 * not on-demand anymore, so the ref and its sha travel with the diff.
 *
 * The diff starts at the merge base, not at the base's tip: what landed on the
 * base since the branch left it is not the branch's change.
 */
export const resolveDiffBase = async (
  cwd: string,
  name: string,
): Promise<ResolvedDiffBase> => {
  const candidates = [
    { ref: `origin/${name}`, fullRef: `refs/remotes/origin/${name}` },
    { ref: name, fullRef: `refs/heads/${name}` },
  ];
  for (const { ref, fullRef } of candidates) {
    const sha = await readCommit(cwd, fullRef);
    if (sha === null) continue;
    const mergeBase = await gitOrNull(cwd, ["merge-base", sha, "HEAD"]);
    if (mergeBase === null) {
      throw new Error(`HEAD shares no history with ${ref}`);
    }
    return { base: { name, ref, sha }, mergeBase: mergeBase.trim() };
  }
  throw new Error(
    `neither origin/${name} nor ${name} exists in ${cwd}: fetch the repository, or check its default branch`,
  );
};

export interface CheckoutBranchDiffParams {
  cwd: string;
  /** absent: the branch `origin/HEAD` names, else `main` */
  baseName?: string;
  scope: BranchDiffScope;
  whitespace?: DiffWhitespace;
  limits?: DiffLimits;
}

const readScopeStart = async (
  cwd: string,
  scope: BranchDiffScope,
  baseName: string | undefined,
): Promise<ResolvedDiffBase | null> => {
  if (scope === "uncommitted") return null;
  const name = baseName ?? (await readDefaultBranch(cwd)) ?? "main";
  return resolveDiffBase(cwd, name);
};

/**
 * The checked-out branch since it left its base (`committed`), or the working
 * tree since `HEAD` (`uncommitted`), grouped by package.
 */
export const readCheckoutBranchDiff = async ({
  cwd,
  baseName,
  scope,
  whitespace = "show",
  limits,
}: CheckoutBranchDiffParams): Promise<CheckoutBranchDiffResponse> => {
  const [branch, start, headSha] = await Promise.all([
    readHeadBranch(cwd),
    readScopeStart(cwd, scope, baseName),
    readHeadSha(cwd),
  ]);
  const { paths, ...diff } = await readBranchDiff({
    cwd,
    mergeBase: start?.mergeBase ?? headSha,
    scope: scope === "uncommitted" ? "workingTree" : "committed",
    whitespace,
    limits,
  });
  return {
    scope,
    whitespace,
    branch,
    headSha,
    base: start?.base ?? null,
    mergeBase: start?.mergeBase ?? null,
    ...diff,
    groups: groupDiffPaths(packagesOnDisk(cwd), paths),
  };
};
