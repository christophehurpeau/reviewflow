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

export const readHeadSha = async (
  cwd: string,
  ref = "HEAD",
): Promise<string> => {
  const sha = await git(cwd, ["rev-parse", ref]);
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

/** Where a read of a checkout starts: its HEAD, or one of its local branches. */
export interface ReadHead {
  ref: string;
  /** null on a detached HEAD */
  branch: string | null;
}

/**
 * The checkout's HEAD when `branch` is absent, else `refs/heads/<branch>`,
 * which must exist: the full ref keeps a name from being taken for an option
 * or for another kind of revision.
 */
export const resolveReadHead = async (
  cwd: string,
  branch: string | undefined,
): Promise<ReadHead> => {
  if (branch === undefined) {
    return { ref: "HEAD", branch: await readHeadBranch(cwd) };
  }
  const ref = `refs/heads/${branch}`;
  if ((await readCommit(cwd, ref)) === null) {
    throw new Error(`no local branch ${branch} in ${cwd}`);
  }
  return { ref, branch };
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
  head = "HEAD",
): Promise<ResolvedDiffBase> => {
  const candidates = [
    { ref: `origin/${name}`, fullRef: `refs/remotes/origin/${name}` },
    { ref: name, fullRef: `refs/heads/${name}` },
  ];
  for (const { ref, fullRef } of candidates) {
    const sha = await readCommit(cwd, fullRef);
    if (sha === null) continue;
    const mergeBase = await gitOrNull(cwd, ["merge-base", sha, head]);
    if (mergeBase === null) {
      throw new Error(`${head} shares no history with ${ref}`);
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
  /** a local branch to read instead of HEAD; `committed` only, it has no working tree here */
  branch?: string;
  whitespace?: DiffWhitespace;
  limits?: DiffLimits;
}

interface ScopeStartParams {
  cwd: string;
  scope: BranchDiffScope;
  baseName: string | undefined;
  head: string;
}

const readScopeStart = async ({
  cwd,
  scope,
  baseName,
  head,
}: ScopeStartParams): Promise<ResolvedDiffBase | null> => {
  if (scope === "uncommitted") return null;
  const name = baseName ?? (await readDefaultBranch(cwd)) ?? "main";
  return resolveDiffBase(cwd, name, head);
};

/**
 * The checked-out branch, or `branch`, since it left its base (`committed`),
 * or the working tree since `HEAD` (`uncommitted`), grouped by package. The
 * packages are those on disk, the checked-out ones, even for another branch.
 */
export const readCheckoutBranchDiff = async ({
  cwd,
  baseName,
  scope,
  branch: branchName,
  whitespace = "show",
  limits,
}: CheckoutBranchDiffParams): Promise<CheckoutBranchDiffResponse> => {
  if (branchName !== undefined && scope === "uncommitted") {
    throw new Error(
      `${branchName} is not checked out here: it has nothing uncommitted`,
    );
  }
  const head = await resolveReadHead(cwd, branchName);
  const [start, headSha] = await Promise.all([
    readScopeStart({ cwd, scope, baseName, head: head.ref }),
    readHeadSha(cwd, head.ref),
  ]);
  const { paths, ...diff } = await readBranchDiff({
    cwd,
    mergeBase: start?.mergeBase ?? headSha,
    head: head.ref,
    scope: scope === "uncommitted" ? "workingTree" : "committed",
    whitespace,
    limits,
  });
  return {
    scope,
    whitespace,
    branch: head.branch,
    headSha,
    base: start?.base ?? null,
    mergeBase: start?.mergeBase ?? null,
    ...diff,
    groups: groupDiffPaths(packagesOnDisk(cwd), paths),
  };
};
