import type {
  CheckoutBranch,
  CheckoutBranchesResponse,
  CheckoutWorktree,
  CheckoutWorktreeStatusesResponse,
} from "../checkout/overview.ts";
import type { BranchDiffBase } from "../diff/types.ts";
import type { StatusV2 } from "./checkoutSync.ts";
import {
  readHeadCommits,
  readStatusV2,
  toCheckoutStatus,
} from "./checkoutSync.ts";
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
 * Every worktree of the repository `cwd` belongs to, the main one first; a
 * bare repository's own entry is left out, having no files. One git call.
 */
export const listWorktrees = async (cwd: string): Promise<CheckoutWorktree[]> =>
  parseWorktreeList(await git(cwd, ["worktree", "list", "--porcelain"]))
    .map((worktree, index) => ({ ...worktree, main: index === 0 }))
    .filter(({ bare }) => !bare)
    .map(({ bare: _bare, ...worktree }) => worktree);

const readStatusOrNull = (
  worktree: CheckoutWorktree,
): Promise<StatusV2 | null> =>
  worktree.prunable
    ? Promise.resolve(null)
    : readStatusV2(worktree.path).catch(() => null);

/**
 * What each worktree holds: one `git status` per worktree, and their head
 * commits in a single call.
 */
export const readWorktreeStatuses = async (
  cwd: string,
): Promise<CheckoutWorktreeStatusesResponse> => {
  const worktrees = await listWorktrees(cwd);
  const statuses = await Promise.all(worktrees.map(readStatusOrNull));
  const commits = await readHeadCommits(
    cwd,
    statuses.flatMap((status) =>
      status?.headSha == null ? [] : [status.headSha],
    ),
  );
  return {
    statuses: worktrees.map(({ path }, index) => {
      const status = statuses[index] ?? null;
      return {
        path,
        status:
          status === null ? null : toCheckoutStatus(path, status, commits),
      };
    }),
  };
};

const fieldSeparator = "\u0000";
const refFormat = [
  "%(refname)",
  "%(objectname)",
  "%(upstream:short)",
  "%(upstream:track)",
  "%(committerdate:iso-strict)",
  "%(worktreepath)",
  "%(symref)",
  "%(subject)",
].join("%00");

const headsPrefix = "refs/heads/";
const originPrefix = "refs/remotes/origin/";
const originHead = `${originPrefix}HEAD`;

interface ListedRef {
  refname: string;
  sha: string;
  upstream: string;
  track: string;
  committedAt: string;
  worktreePath: string;
  symref: string;
  subject: string;
}

const parseRefs = (output: string): ListedRef[] =>
  output
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => {
      const [
        refname = "",
        sha = "",
        upstream = "",
        track = "",
        committedAt = "",
        worktreePath = "",
        symref = "",
        subject = "",
      ] = line.split(fieldSeparator);
      return {
        refname,
        sha,
        upstream,
        track,
        committedAt,
        worktreePath,
        symref,
        subject,
      };
    });

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

/** The branch `origin/HEAD` names, as `readDefaultBranch` reads it. */
const defaultBranchOf = (refs: ListedRef[]): string | null => {
  const symref = refs.find(({ refname }) => refname === originHead)?.symref;
  if (symref === undefined || !symref.startsWith(originPrefix)) return null;
  return symref.slice(originPrefix.length);
};

/** `origin/<name>` before `<name>`, as `resolveDiffBase` picks it. */
const findBase = (
  refs: ListedRef[],
  baseName: string | undefined,
): BranchDiffBase | null => {
  const name = baseName ?? defaultBranchOf(refs) ?? "main";
  const shaOf = (refname: string): string | null =>
    refs.find((ref) => ref.refname === refname)?.sha ?? null;
  const remoteSha = shaOf(`${originPrefix}${name}`);
  if (remoteSha !== null) {
    return { name, ref: `origin/${name}`, sha: remoteSha };
  }
  const localSha = shaOf(`${headsPrefix}${name}`);
  return localSha === null ? null : { name, ref: name, sha: localSha };
};

const readMergedBranches = async (
  cwd: string,
  base: BranchDiffBase | null,
): Promise<Set<string>> => {
  if (base === null) return new Set();
  const listed = await git(cwd, [
    "for-each-ref",
    `--merged=${base.sha}`,
    "--format=%(refname:lstrip=2)",
    "refs/heads",
  ]);
  return new Set(
    listed.split("\n").filter((name) => name !== "" && name !== base.name),
  );
};

const toBranch = (ref: ListedRef, merged: Set<string>): CheckoutBranch => {
  const name = ref.refname.slice(headsPrefix.length);
  const { ahead, behind, gone } = parseTrack(ref.track, ref.upstream !== "");
  return {
    name,
    sha: ref.sha,
    upstream: ref.upstream === "" ? null : ref.upstream,
    ahead,
    behind,
    upstreamGone: gone,
    merged: merged.has(name),
    worktreePath: ref.worktreePath === "" ? null : ref.worktreePath,
    lastCommit: {
      subject: ref.subject,
      committedAt: new Date(ref.committedAt).toISOString(),
    },
  };
};

export interface ReadBranchesParams {
  cwd: string;
  /** absent: the branch `origin/HEAD` names, else `main` */
  baseName?: string;
}

/**
 * The local branches, most recently committed first, and the worktrees they
 * are checked out in, without their status (`readWorktreeStatuses`). Nothing
 * is fetched: ahead, behind and gone are as of the last fetch. Three git calls,
 * whatever the number of branches and worktrees.
 */
export const readBranches = async ({
  cwd,
  baseName,
}: ReadBranchesParams): Promise<CheckoutBranchesResponse> => {
  const [listing, worktrees] = await Promise.all([
    gitOrNull(cwd, [
      "for-each-ref",
      "--sort=-committerdate",
      `--format=${refFormat}`,
      "refs/heads",
      "refs/remotes/origin",
    ]),
    listWorktrees(cwd),
  ]);
  const refs = parseRefs(listing ?? "");
  const base = findBase(refs, baseName);
  const merged = await readMergedBranches(cwd, base);
  const branches = refs
    .filter(({ refname }) => refname.startsWith(headsPrefix))
    .map((ref) => toBranch(ref, merged));
  return { base, worktrees, branches };
};
