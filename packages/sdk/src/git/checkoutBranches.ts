import type {
  CheckoutBranch,
  CheckoutBranchesResponse,
  CheckoutWorktree,
} from "../checkout/overview.ts";
import type { ResolvedDiffBase } from "./checkoutBranchDiff.ts";
import { readDefaultBranch, resolveDiffBase } from "./checkoutBranchDiff.ts";
import { readCheckoutStatus } from "./checkoutSync.ts";
import { git, gitOrNull } from "./run.ts";

interface ListedWorktree {
  path: string;
  branch: string | null;
  headSha: string | null;
  bare: boolean;
  /** why it is locked, `""` when no reason was given; null when it is not */
  lock: string | null;
  prunable: boolean;
}

const zeroSha = /^0+$/;

/**
 * `git worktree list --porcelain`: one block per worktree, blocks separated by
 * an empty line, each opening with `worktree <path>`; `HEAD`, `branch`,
 * `detached`, `bare`, `locked` and `prunable` follow. A worktree on a branch
 * with no commit yet has an all-zero `HEAD`.
 */
export const parseWorktreeList = (output: string): ListedWorktree[] =>
  output
    .split(/\n{2,}/)
    .map((block) => block.split("\n").filter((line) => line !== ""))
    .filter((lines) => lines[0]?.startsWith("worktree ") === true)
    .map((lines) => {
      const value = (key: string): string | null => {
        const line = lines.find(
          (candidate) => candidate === key || candidate.startsWith(`${key} `),
        );
        return line === undefined ? null : line.slice(key.length + 1);
      };
      const head = value("HEAD");
      const branch = value("branch");
      return {
        path: value("worktree") ?? "",
        branch: branch === null ? null : branch.replace(/^refs\/heads\//, ""),
        headSha: head === null || zeroSha.test(head) ? null : head,
        bare: value("bare") !== null,
        lock: value("locked"),
        prunable: value("prunable") !== null,
      };
    });

/**
 * Every worktree of the repository `cwd` belongs to, the main one first, each
 * with its status; a bare repository's own entry is left out, having no files.
 */
export const readWorktrees = async (
  cwd: string,
): Promise<CheckoutWorktree[]> => {
  const listed = parseWorktreeList(
    await git(cwd, ["worktree", "list", "--porcelain"]),
  );
  return Promise.all(
    listed
      .map((worktree, index) => ({ ...worktree, main: index === 0 }))
      .filter(({ bare }) => !bare)
      .map(async ({ bare: _bare, ...worktree }) => ({
        ...worktree,
        status: worktree.prunable
          ? null
          : await readCheckoutStatus(worktree.path).catch(() => null),
      })),
  );
};

const fieldSeparator = "\u0000";
const branchFormat = [
  "%(refname:lstrip=2)",
  "%(objectname)",
  "%(upstream:short)",
  "%(upstream:track)",
  "%(committerdate:iso-strict)",
  "%(worktreepath)",
  "%(subject)",
].join("%00");

interface Track {
  ahead: number | null;
  behind: number | null;
  gone: boolean;
}

/**
 * `%(upstream:track)`: `[ahead 2, behind 1]`, `[gone]`, or empty both in sync
 * and without an upstream, which `hasUpstream` tells apart.
 */
export const parseTrack = (track: string, hasUpstream: boolean): Track => {
  if (!hasUpstream) return { ahead: null, behind: null, gone: false };
  if (track === "[gone]") return { ahead: null, behind: null, gone: true };
  const count = (word: string): number =>
    Number(new RegExp(`${word} (\\d+)`).exec(track)?.[1] ?? 0);
  return { ahead: count("ahead"), behind: count("behind"), gone: false };
};

const readMergedBranches = async (
  cwd: string,
  start: ResolvedDiffBase | null,
): Promise<Set<string>> => {
  if (start === null) return new Set();
  const listed = await git(cwd, [
    "for-each-ref",
    `--merged=${start.base.sha}`,
    "--format=%(refname:lstrip=2)",
    "refs/heads",
  ]);
  return new Set(
    listed
      .split("\n")
      .filter((name) => name !== "" && name !== start.base.name),
  );
};

const readBase = async (
  cwd: string,
  baseName: string | undefined,
): Promise<ResolvedDiffBase | null> => {
  const name = baseName ?? (await readDefaultBranch(cwd)) ?? "main";
  return resolveDiffBase(cwd, name).catch(() => null);
};

export interface ReadBranchesParams {
  cwd: string;
  /** absent: the branch `origin/HEAD` names, else `main` */
  baseName?: string;
}

/**
 * The local branches, most recently committed first, and the worktrees they
 * are checked out in. Nothing is fetched: ahead, behind and gone are as of the
 * last fetch.
 */
export const readBranches = async ({
  cwd,
  baseName,
}: ReadBranchesParams): Promise<CheckoutBranchesResponse> => {
  const start = await readBase(cwd, baseName);
  const [listing, merged, worktrees] = await Promise.all([
    gitOrNull(cwd, [
      "for-each-ref",
      "--sort=-committerdate",
      `--format=${branchFormat}`,
      "refs/heads",
    ]),
    readMergedBranches(cwd, start),
    readWorktrees(cwd),
  ]);
  const branches = (listing ?? "")
    .split("\n")
    .filter((line) => line !== "")
    .map((line): CheckoutBranch => {
      const [
        name = "",
        sha = "",
        upstream = "",
        track = "",
        committedAt = "",
        worktreePath = "",
        subject = "",
      ] = line.split(fieldSeparator);
      const { ahead, behind, gone } = parseTrack(track, upstream !== "");
      return {
        name,
        sha,
        upstream: upstream === "" ? null : upstream,
        ahead,
        behind,
        upstreamGone: gone,
        merged: merged.has(name),
        worktreePath: worktreePath === "" ? null : worktreePath,
        lastCommit: {
          subject,
          committedAt: new Date(committedAt).toISOString(),
        },
      };
    });
  return { base: start?.base ?? null, worktrees, branches };
};
