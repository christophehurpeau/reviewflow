import { execFile } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { lstat, readdir } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, sep } from "node:path";
import { pid } from "node:process";
import { promisify } from "node:util";
import type {
  LocalOnlyIgnored,
  ProcessInside,
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
 * `lsof` and `ps` exit 1 with a partial listing when some processes cannot be
 * read or have ended, which is still an answer.
 */
const runForAnswer = async (
  command: string,
  args: string[],
): Promise<string | null> =>
  execFileAsync(command, args, {
    timeout: 10_000,
    maxBuffer: 16 * 1024 * 1024,
  }).then(
    ({ stdout }) => stdout,
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

export interface ProcessRow {
  parentPid: number;
  elapsedSeconds: number;
  /** a full path on macOS, the name alone on linux */
  executable: string;
}

/** `pid ppid etime comm`, etime being `[[dd-]hh:]mm:ss` */
const processRowPattern =
  /^\s*(\d+)\s+(\d+)\s+(?:(\d+)-)?(?:(\d+):)?(\d+):(\d+) +(\S.*)$/;

/** Parses `ps -A -o pid=,ppid=,etime=,comm=`. */
export const parseProcessTable = (stdout: string): Map<number, ProcessRow> => {
  const table = new Map<number, ProcessRow>();
  for (const line of stdout.split("\n")) {
    const match = processRowPattern.exec(line);
    if (match === null) continue;
    const days = Number(match[3] ?? 0);
    const hours = Number(match[4] ?? 0);
    const minutes = Number(match[5]);
    const seconds = Number(match[6]);
    table.set(Number(match[1]), {
      parentPid: Number(match[2]),
      elapsedSeconds: ((days * 24 + hours) * 60 + minutes) * 60 + seconds,
      executable: (match[7] ?? "").trim(),
    });
  }
  return table;
};

const appBundlePattern = /\/([^/]+)\.app\//;

/** A login shell is listed as `-zsh`. */
const processName = (executable: string): string =>
  basename(executable).replace(/^-/, "");

/**
 * The first ancestor run from a `.app` bundle, else the root of the tree under
 * the init process: a terminal app's shells go through `login` and a helper
 * before reaching the app, and a tmux server is re-parented to init.
 */
export const launcherOf = (
  table: Map<number, ProcessRow>,
  processId: number,
): string | null => {
  const visited = new Set([processId]);
  let root: ProcessRow | null = null;
  let parentPid = table.get(processId)?.parentPid;
  while (parentPid !== undefined && parentPid > 1 && !visited.has(parentPid)) {
    const parent = table.get(parentPid);
    if (parent === undefined) break;
    const app = appBundlePattern.exec(parent.executable)?.[1];
    if (app !== undefined) return app;
    visited.add(parentPid);
    root = parent;
    parentPid = parent.parentPid;
  }
  return root === null ? null : processName(root.executable);
};

const readProcessTable = async (): Promise<Map<number, ProcessRow> | null> => {
  const stdout = await runForAnswer("ps", [
    "-A",
    "-o",
    "pid=,ppid=,etime=,comm=",
  ]);
  return stdout === null ? null : parseProcessTable(stdout);
};

const commandLinePattern = /^\s*(\d+) +(\S.*)$/;

const readCommandLines = async (
  processIds: number[],
): Promise<Map<number, string>> => {
  const stdout = await runForAnswer("ps", [
    "-o",
    "pid=,args=",
    "-p",
    processIds.join(","),
  ]);
  const commandLines = new Map<number, string>();
  for (const line of stdout?.split("\n") ?? []) {
    const match = commandLinePattern.exec(line);
    if (match?.[2] !== undefined) {
      commandLines.set(Number(match[1]), match[2].trim());
    }
  }
  return commandLines;
};

/**
 * `lsof -d cwd` lists every process's working directory in one call; without
 * `lsof` at all nothing can be told, and null refuses nothing. This server's
 * own process is not listed. `ps` then names each one; a process that ended
 * in between is dropped, and without `ps` the bare names `lsof` gave are kept.
 */
export const listProcessesInside = async (
  directory: string,
): Promise<ProcessInside[] | null> => {
  const stdout = await runForAnswer("lsof", ["-n", "-d", "cwd", "-F", "pcn"]);
  if (stdout === null) return null;
  const root = realpathOrSelf(directory);
  const names = new Map<number, string>();
  let processId = 0;
  let name = "";
  for (const line of stdout.split("\n")) {
    if (line.startsWith("p")) processId = Number(line.slice(1));
    else if (line.startsWith("c")) name = line.slice(1);
    else if (
      line.startsWith("n") &&
      processId !== pid &&
      isInsideDirectory(root, line.slice(1))
    ) {
      names.set(processId, name);
    }
  }
  const processIds = [...names.keys()].toSorted((a, b) => a - b);
  if (processIds.length === 0) return [];

  const [table, commandLines] = await Promise.all([
    readProcessTable(),
    readCommandLines(processIds),
  ]);
  if (table === null) {
    return processIds.map((id) => ({
      pid: id,
      command: names.get(id) ?? "",
      startedAt: null,
      launchedBy: null,
    }));
  }
  const now = Date.now();
  return processIds.flatMap((id) => {
    const row = table.get(id);
    if (row === undefined) return [];
    return [
      {
        pid: id,
        command: commandLines.get(id) ?? processName(row.executable),
        startedAt: new Date(now - row.elapsedSeconds * 1000).toISOString(),
        launchedBy: launcherOf(table, id),
      },
    ];
  });
};

const ignoredPrefix = "!! ";

/**
 * Directory names that hold dependencies, caches or build outputs: what they
 * hold is downloaded or generated again, so they are named and never walked
 * (an expo prebuild's `ios/Pods` alone is some 20,000 files).
 */
const regenerableDirectoryNames = new Set([
  ".cache",
  ".expo",
  ".gradle",
  ".next",
  ".turbo",
  "build",
  "coverage",
  "DerivedData",
  "dist",
  "node_modules",
  "Pods",
]);

/** The path down to its first regenerable directory, null when none of its directories is one. */
const regenerableAncestor = (relativePath: string): string | null => {
  const segments = relativePath.split(sep);
  const index = segments.findIndex((segment) =>
    regenerableDirectoryNames.has(segment),
  );
  return index === -1 ? null : segments.slice(0, index + 1).join(sep);
};

interface DirectoryWalk {
  files: number;
  regenerable: string[];
}

const emptyWalk: DirectoryWalk = { files: 0, regenerable: [] };

/** Counts the files under a directory, stopping at a regenerable directory, which it names instead. */
const walkDirectory = async (
  worktree: string,
  relativeDirectory: string,
): Promise<DirectoryWalk> => {
  const entries = await readdir(join(worktree, relativeDirectory), {
    withFileTypes: true,
  }).catch(() => []);
  const walks = await Promise.all(
    entries.map(async (entry): Promise<DirectoryWalk> => {
      const path = join(relativeDirectory, entry.name);
      if (entry.isFile()) return { files: 1, regenerable: [] };
      if (!entry.isDirectory()) return emptyWalk;
      if (regenerableDirectoryNames.has(entry.name)) {
        return { files: 0, regenerable: [path] };
      }
      return walkDirectory(worktree, path);
    }),
  );
  return {
    files: walks.reduce((total, walk) => total + walk.files, 0),
    regenerable: walks.flatMap((walk) => walk.regenerable),
  };
};

const toRegenerable = (path: string): LocalOnlyIgnored => ({
  kind: "regenerable",
  path,
});

const describeIgnoredDirectory = async (
  worktree: string,
  relativeDirectory: string,
): Promise<LocalOnlyIgnored[]> => {
  const { files, regenerable } = await walkDirectory(
    worktree,
    relativeDirectory,
  );
  const directory: LocalOnlyIgnored[] =
    files === 0 ? [] : [{ kind: "directory", path: relativeDirectory, files }];
  return [...directory, ...regenerable.map(toRegenerable)];
};

const byPath = (a: LocalOnlyIgnored, b: LocalOnlyIgnored): number =>
  a.path.localeCompare(b.path);

/**
 * Compared by existence, not content: git collapses an ignored directory to one
 * entry, and walking a `node_modules` to compare it is not a read to make on
 * every confirmation. A symlink points at a file that survives, and a path the
 * main checkout also has is regenerable or duplicated.
 */
const listLocalOnlyIgnored = async (
  worktree: string,
  mainCheckout: string,
): Promise<LocalOnlyIgnored[]> => {
  const porcelain = await git(worktree, [
    "status",
    "--porcelain",
    "--ignored",
    "-z",
  ]);
  const ignored = porcelain
    .split("\0")
    .filter((entry) => entry.startsWith(ignoredPrefix))
    .map((entry) => entry.slice(ignoredPrefix.length).replace(/\/$/, ""));
  const localOnly = await Promise.all(
    ignored.map(async (relativePath): Promise<LocalOnlyIgnored[]> => {
      // gone between the status and this read: nothing left to lose
      const entry = await lstat(join(worktree, relativePath)).catch(() => null);
      if (entry === null || entry.isSymbolicLink()) return [];
      if (existsSync(join(mainCheckout, relativePath))) return [];
      const regenerable = regenerableAncestor(relativePath);
      if (regenerable !== null) return [toRegenerable(regenerable)];
      if (entry.isDirectory()) {
        return describeIgnoredDirectory(worktree, relativePath);
      }
      return [{ kind: "file", path: relativePath }];
    }),
  );
  const entries = localOnly.flat();
  const regenerablePaths = new Set(
    entries
      .filter((entry) => entry.kind === "regenerable")
      .map((entry) => entry.path),
  );
  return [
    ...entries.filter((entry) => entry.kind !== "regenerable").toSorted(byPath),
    ...[...regenerablePaths].map(toRegenerable).toSorted(byPath),
  ];
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
  const processesInside = await listProcessesInside(worktree);
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
