import type {
  BranchDiffBase,
  CheckoutCommit,
  CheckoutCommitsResponse,
  CommitDiffResponse,
  DiffWhitespace,
} from "../diff/types.ts";
import {
  readDefaultBranch,
  readHeadBranch,
  resolveDiffBase,
} from "./checkoutBranchDiff.ts";
import { groupDiffPaths, packagesOnDisk } from "./groupDiffPaths.ts";
import type { DiffLimits } from "./readBranchDiff.ts";
import { readBranchDiff } from "./readBranchDiff.ts";
import { git, gitOrNull } from "./run.ts";

export const defaultRecentCommits = 30;

const fieldSeparator = "\u001F";
const recordSeparator = "\u001E";
const logFormat = ["%H", "%P", "%an", "%cI", "%s", "%b"].join("%x1f");

interface LoggedCommit {
  sha: string;
  parents: string[];
  author: string;
  committedAt: string;
  headline: string;
  body: string;
}

const parseLog = (output: string): LoggedCommit[] =>
  output
    .split(recordSeparator)
    .map((record) => record.replace(/^\n/, ""))
    .filter((record) => record !== "")
    .map((record) => {
      const [
        sha = "",
        parents = "",
        author = "",
        committedAt = "",
        headline = "",
        body = "",
      ] = record.split(fieldSeparator);
      return {
        sha,
        parents: parents === "" ? [] : parents.split(" "),
        author,
        committedAt,
        headline,
        body: body.trim(),
      };
    });

interface BranchStart {
  base: BranchDiffBase;
  /** the branch's commits among the listed ones: HEAD has them, the base has not */
  onBranch: Set<string>;
  /** every commit of the branch, listed or not */
  count: number;
}

/**
 * Null when the base cannot be resolved: nothing is then marked on the branch.
 * The range keeps `git log`'s order, so its first `limit` commits hold every
 * listed one it has.
 */
const readBranchStart = async (
  cwd: string,
  baseName: string | undefined,
  limit: number,
): Promise<BranchStart | null> => {
  const name = baseName ?? (await readDefaultBranch(cwd)) ?? "main";
  try {
    const { base, mergeBase } = await resolveDiffBase(cwd, name);
    const range = `${mergeBase}..HEAD`;
    const [listed, count] = await Promise.all([
      git(cwd, ["rev-list", `--max-count=${String(limit)}`, range]),
      git(cwd, ["rev-list", "--count", range]),
    ]);
    return {
      base,
      onBranch: new Set(listed.split("\n").filter((sha) => sha !== "")),
      count: Number(count.trim()),
    };
  } catch {
    return null;
  }
};

/**
 * The commits among HEAD's last `limit` that no remote-tracking ref reaches:
 * `--not --remotes` keeps rev-list's order, so the ones in the log are all in
 * its first `limit`. Null when the checkout has no remote, where every commit
 * would read as not pushed.
 */
const readUnpushed = async (
  cwd: string,
  limit: number,
): Promise<Set<string> | null> => {
  const remotes = await git(cwd, ["remote"]);
  if (remotes.trim() === "") return null;
  const listed = await gitOrNull(cwd, [
    "rev-list",
    `--max-count=${String(limit)}`,
    "HEAD",
    "--not",
    "--remotes",
  ]);
  return new Set((listed ?? "").split("\n").filter((sha) => sha !== ""));
};

export interface RecentCommitsParams {
  cwd: string;
  /** `defaultRecentCommits` unless set */
  limit?: number;
  /** absent: the branch `origin/HEAD` names, else `main` */
  baseName?: string;
}

/**
 * The last commits of HEAD, newest first, each marked when the branch carries
 * it since it left its base, and when it is pushed. A repository without a
 * commit has none.
 */
export const readRecentCommits = async ({
  cwd,
  limit = defaultRecentCommits,
  baseName,
}: RecentCommitsParams): Promise<CheckoutCommitsResponse> => {
  const [branch, start, unpushed, log] = await Promise.all([
    readHeadBranch(cwd),
    readBranchStart(cwd, baseName, limit),
    readUnpushed(cwd, limit),
    gitOrNull(cwd, [
      "log",
      "--no-color",
      `--max-count=${String(limit)}`,
      `--format=${logFormat}%x1e`,
      "HEAD",
    ]),
  ]);
  const commits = parseLog(log ?? "").map((commit): CheckoutCommit => ({
    oid: commit.sha,
    parentOid: commit.parents[0] ?? null,
    merge: commit.parents.length > 1,
    headline: commit.headline,
    body: commit.body,
    author: { login: commit.author, avatarUrl: null },
    committedAt: commit.committedAt,
    onBranch: start?.onBranch.has(commit.sha) ?? false,
    pushed: unpushed === null ? null : !unpushed.has(commit.sha),
  }));
  return {
    branch,
    base: start?.base ?? null,
    onBranchCount: start?.count ?? null,
    commits,
  };
};

/** The empty tree, in whichever object format the repository uses. */
const emptyTree = async (cwd: string): Promise<string> => {
  const tree = await git(cwd, ["hash-object", "-t", "tree", "/dev/null"]);
  return tree.trim();
};

export interface CommitDiffParams {
  cwd: string;
  sha: string;
  whitespace?: DiffWhitespace;
  limits?: DiffLimits;
}

/**
 * One commit against its first parent, a merge included (its diff then
 * carries what was merged in); a root commit against the empty tree.
 */
export const readCommitDiff = async ({
  cwd,
  sha,
  whitespace = "show",
  limits,
}: CommitDiffParams): Promise<CommitDiffResponse> => {
  const listed = await git(cwd, [
    "rev-list",
    "--parents",
    "--max-count=1",
    `${sha}^{commit}`,
  ]);
  const [commit = sha, parentSha = null] = listed.trim().split(" ");
  const { paths, patch, omitted } = await readBranchDiff({
    cwd,
    mergeBase: parentSha ?? (await emptyTree(cwd)),
    head: commit,
    scope: "committed",
    whitespace,
    limits,
  });
  return {
    sha: commit,
    parentSha,
    whitespace,
    patch,
    omitted,
    groups: groupDiffPaths(packagesOnDisk(cwd), paths),
  };
};
