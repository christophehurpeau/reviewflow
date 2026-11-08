import { execFile } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { lstat, readdir } from "node:fs/promises";
import { dirname, isAbsolute, join, relative } from "node:path";
import { pid } from "node:process";
import { promisify } from "node:util";
import type {
  WorktreeRemovalResult,
  WorktreeRemovalStatus,
} from "../checkout/worktreeRemoval.ts";
import { worktreeRemovalRefusal } from "../checkout/worktreeRemoval.ts";
import { parseWorktreeList } from "./checkoutBranches.ts";
import { git, gitOrNull } from "./run.ts";

const execFileAsync = promisify(execFile);

const realpathOrSelf = (path: string): string => {
  try {
    return realpathSync.native(path);
  } catch {
    return path;
  }
};

const isInsideDirectory = (directory: string, path: string): boolean => {
  const relativePath = relative(directory, path);
  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !isAbsolute(relativePath))
  );
};

const readGitDirectory = async (
  worktree: string,
  flag: "--git-common-dir" | "--git-dir",
): Promise<string> => {
  const directory = await git(worktree, [
    "rev-parse",
    "--path-format=absolute",
    flag,
  ]);
  return realpathOrSelf(directory.trim());
};

/**
 * The branch read from git, never from a cached listing: it is what
 * `git branch -d` is handed. `--abbrev-ref` answers the literal `HEAD` on a
 * detached head, the one case with no branch to delete.
 */
const readBranch = async (worktree: string): Promise<string | null> => {
  const branch = await gitOrNull(worktree, [
    "rev-parse",
    "--abbrev-ref",
    "HEAD",
  ]);
  const name = branch?.trim() ?? "";
  return name === "" || name === "HEAD" ? null : name;
};

/**
 * `??` is an untracked path, every other code a tracked change. Ignored files
 * are absent without `--ignored`: `git worktree remove` ignores them too, so
 * counting them would predict a refusal that never comes.
 */
const countChanges = async (
  worktree: string,
): Promise<Pick<WorktreeRemovalStatus, "modified" | "untracked">> => {
  const porcelain = await git(worktree, ["status", "--porcelain"]);
  const lines = porcelain.split("\n").filter((line) => line.trim() !== "");
  const untracked = lines.filter((line) => line.startsWith("??")).length;
  return { modified: lines.length - untracked, untracked };
};

const hasCommit = async (worktree: string, sha: string): Promise<boolean> =>
  (await gitOrNull(worktree, ["cat-file", "-e", `${sha}^{commit}`])) !== null;

/**
 * Commits on HEAD reachable from no remote-tracking ref and from no kept sha.
 * Not `@{u}..HEAD`: that has no answer once the upstream is gone, the normal
 * state of a merged branch after `fetch --prune`, and it ignores a commit
 * already on another remote branch. A kept sha missing from the object store
 * is left out, which only counts more as unpushed: the guard errs toward
 * refusing.
 */
const countUnpushedCommits = async (
  worktree: string,
  keptShas: string[],
): Promise<number> => {
  const present = await Promise.all(
    keptShas
      .filter((sha) => /^[\da-f]{7,64}$/i.test(sha))
      .map(async (sha) => ((await hasCommit(worktree, sha)) ? sha : null)),
  );
  const count = await gitOrNull(worktree, [
    "rev-list",
    "--count",
    "HEAD",
    "--not",
    "--remotes",
    ...present.filter((sha) => sha !== null),
  ]);
  return count === null ? 0 : Number(count.trim());
};

const readLock = async (worktree: string): Promise<string | null> => {
  const listed = parseWorktreeList(
    await git(worktree, ["worktree", "list", "--porcelain"]),
  );
  const own = listed.find(
    ({ path }) => realpathOrSelf(path) === realpathOrSelf(worktree),
  );
  return own?.lock ?? null;
};

/**
 * `lsof -d cwd` lists every process's working directory in one call. It exits
 * 1 with a partial listing when some processes cannot be read, which is still
 * an answer; without `lsof` at all nothing can be told, and null refuses
 * nothing. This server's own process is not counted.
 */
export const countProcessesInside = async (
  directory: string,
): Promise<number | null> => {
  const stdout = await execFileAsync("lsof", ["-n", "-d", "cwd", "-F", "pn"], {
    timeout: 10_000,
    maxBuffer: 16 * 1024 * 1024,
  }).then(
    ({ stdout: answer }) => answer,
    (error: unknown) => {
      if (
        typeof error === "object" &&
        error !== null &&
        "stdout" in error &&
        typeof error.stdout === "string" &&
        error.stdout !== ""
      ) {
        return error.stdout;
      }
      return null;
    },
  );
  if (stdout === null) return null;
  const root = realpathOrSelf(directory);
  const inside = new Set<string>();
  let processId = "";
  for (const line of stdout.split("\n")) {
    if (line.startsWith("p")) processId = line.slice(1);
    else if (
      line.startsWith("n") &&
      processId !== String(pid) &&
      isInsideDirectory(root, line.slice(1))
    ) {
      inside.add(processId);
    }
  }
  return inside.size;
};

const ignoredPrefix = "!! ";

/** A directory git collapsed to one entry, named file by file. */
const listFiles = async (
  worktree: string,
  relativeDirectory: string,
): Promise<string[]> => {
  const entries = await readdir(join(worktree, relativeDirectory), {
    recursive: true,
    withFileTypes: true,
  }).catch(() => []);
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(worktree, join(entry.parentPath, entry.name)))
    .toSorted();
};

/**
 * Compared by existence, not content: git collapses an ignored directory to one
 * entry, and walking a `node_modules` to compare it is not a read to make on
 * every confirmation. A symlink points at a file that survives, and a path the
 * main checkout also has is regenerable or duplicated.
 */
const listLocalOnlyIgnored = async (
  worktree: string,
  mainCheckout: string,
): Promise<string[]> => {
  const porcelain = await git(worktree, [
    "status",
    "--porcelain",
    "--ignored",
    "-z",
  ]);
  const ignored = porcelain
    .split("\0")
    .filter((entry) => entry.startsWith(ignoredPrefix))
    .map((entry) => entry.slice(ignoredPrefix.length));
  const localOnly = await Promise.all(
    ignored.map(async (relativePath): Promise<string[]> => {
      // gone between the status and this read: nothing left to lose
      const entry = await lstat(join(worktree, relativePath)).catch(() => null);
      if (entry === null || entry.isSymbolicLink()) return [];
      if (existsSync(join(mainCheckout, relativePath))) return [];
      return entry.isDirectory()
        ? listFiles(worktree, relativePath)
        : [relativePath];
    }),
  );
  return localOnly.flat();
};

export interface ReadWorktreeRemovalStatusParams {
  /** the worktree, absolute */
  worktree: string;
  /**
   * Commits known to be safe elsewhere although no remote-tracking ref holds
   * them: the pull request heads GitHub keeps after deleting a head branch.
   */
  keptShas?: string[];
}

/**
 * What removing the worktree would lose, read from git and the disk alone.
 * Advisory on a surface: `prepareWorktreeRemoval` reads it again and refuses.
 */
export const readWorktreeRemovalStatus = async ({
  worktree,
  keptShas = [],
}: ReadWorktreeRemovalStatusParams): Promise<WorktreeRemovalStatus> => {
  const [gitDirectory, commonDirectory] = await Promise.all([
    readGitDirectory(worktree, "--git-dir"),
    readGitDirectory(worktree, "--git-common-dir"),
  ]);
  const [branch, changes, unpushedCommits, lock, ignored] = await Promise.all([
    readBranch(worktree),
    countChanges(worktree),
    countUnpushedCommits(worktree, keptShas),
    readLock(worktree),
    listLocalOnlyIgnored(worktree, dirname(commonDirectory)),
  ]);
  // after the reads: the gits they run have their working directory inside too
  const processesInside = await countProcessesInside(worktree);
  return {
    path: worktree,
    main: gitDirectory === commonDirectory,
    branch,
    ...changes,
    unpushedCommits,
    lock,
    processesInside,
    localOnlyIgnored: ignored,
  };
};

/** A removal every refusal has passed: what `completeWorktreeRemoval` runs. */
export interface WorktreeRemovalPlan {
  path: string;
  /** where git runs from: the repository's `.git`, which outlives the worktree */
  commonDirectory: string;
  /** null when not asked for, or on a detached HEAD */
  branch: string | null;
}

export interface PrepareWorktreeRemovalParams extends ReadWorktreeRemovalStatusParams {
  /** run `git branch -d` on its branch after the removal */
  deleteBranch: boolean;
}

/**
 * Reads the status now and throws the first refusal, before anything is
 * deleted; a caller with guards of its own (a live session) runs them before
 * this. Split from the removal so a caller can answer once every refusal has
 * passed and remove after.
 */
export const prepareWorktreeRemoval = async ({
  deleteBranch,
  ...params
}: PrepareWorktreeRemovalParams): Promise<WorktreeRemovalPlan> => {
  const status = await readWorktreeRemovalStatus(params);
  const refusal = worktreeRemovalRefusal(status);
  if (refusal !== null) throw new Error(refusal);
  return {
    path: status.path,
    commonDirectory: await readGitDirectory(
      params.worktree,
      "--git-common-dir",
    ),
    branch: deleteBranch ? status.branch : null,
  };
};

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * `git worktree remove` with no `--force`, then `git branch -d` (never `-D`,
 * never a remote) when the plan carries a branch. The removal is
 * `uninterruptible`: killed midway, it leaves half the tracked files gone and
 * a worktree git then refuses as dirty, so neither a client leaving nor a
 * signal to this process stops it. A refused branch deletion is reported in
 * the result; the removal stands. A refused removal throws git's reason.
 */
export const completeWorktreeRemoval = async ({
  path,
  commonDirectory,
  branch,
}: WorktreeRemovalPlan): Promise<WorktreeRemovalResult> => {
  await git(commonDirectory, ["worktree", "remove", path], {
    uninterruptible: true,
  });
  if (branch === null) return { path, branch, branchError: null };
  try {
    await git(commonDirectory, ["branch", "-d", branch]);
    return { path, branch, branchError: null };
  } catch (error) {
    return { path, branch, branchError: messageOf(error) };
  }
};
