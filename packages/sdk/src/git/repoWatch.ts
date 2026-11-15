import type { FSWatcher } from "node:fs";
import { watch } from "node:fs";
import { join } from "node:path";
import { filterIgnoredPaths, readGitCommonDir } from "./ignoredPaths.ts";

/**
 * `git`: a ref or a HEAD moved (a commit, a checkout, a fetch, a branch
 * created or deleted); `files`: a file git does not ignore changed in the
 * watched working tree.
 */
export type RepoChange = "files" | "git";

export interface RepoWatchParams {
  /** the directory every worktree shares: refs, packed-refs, each worktree's HEAD */
  gitCommonDir: string;
  /** the working tree whose files are watched */
  worktree: string;
  /** keeps the paths (relative to `worktree`) git does not ignore */
  filterIgnored: (paths: string[]) => Promise<string[]>;
  onChange: (change: RepoChange) => void;
  /** a watcher failed, e.g. too many open files: no change is reported anymore */
  onError: (error: unknown) => void;
}

/** Changes are reported once they settle, and at least this often while they go on. */
const settleMs = 300;
const maxWaitMs = 2000;

/**
 * macOS replays what happened just before the stream started (the watched
 * directory itself included): those are dropped. The screens read everything
 * when they open, so nothing they miss happened here.
 */
const replayWindowMs = 300;

const toPosix = (path: string): string => path.replaceAll("\\", "/");

/**
 * The index is left out on purpose: `git status` rewrites it, so watching it
 * would turn every read into another change. Staging does not move what the
 * screens show, which compare the working tree with HEAD.
 */
export const isRefChange = (relativePath: string): boolean => {
  const path = toPosix(relativePath);
  if (path.endsWith(".lock")) return false;
  return (
    path === "HEAD" ||
    path === "packed-refs" ||
    path.startsWith("refs/") ||
    /^worktrees\/[^/]+\/HEAD$/.test(path)
  );
};

/** The repository's own directory, in the main checkout or a `.git` file's place. */
export const isGitPath = (relativePath: string): boolean => {
  const path = toPosix(relativePath);
  return path === ".git" || path.startsWith(".git/");
};

interface Batcher {
  add: (path: string) => void;
  stop: () => void;
}

const createBatcher = (flush: (paths: string[]) => void): Batcher => {
  let pending = new Set<string>();
  let settleTimer: ReturnType<typeof setTimeout> | null = null;
  let firstAt: number | null = null;

  const run = (): void => {
    if (settleTimer !== null) clearTimeout(settleTimer);
    settleTimer = null;
    firstAt = null;
    const paths = [...pending];
    pending = new Set();
    if (paths.length > 0) flush(paths);
  };

  return {
    add: (path) => {
      pending.add(path);
      const now = Date.now();
      firstAt ??= now;
      if (settleTimer !== null) clearTimeout(settleTimer);
      const wait = Math.min(settleMs, Math.max(0, firstAt + maxWaitMs - now));
      settleTimer = setTimeout(run, wait);
    },
    stop: () => {
      if (settleTimer !== null) clearTimeout(settleTimer);
      settleTimer = null;
      pending = new Set();
    },
  };
};

/**
 * Follows a repository's refs and one working tree's files through the
 * operating system's file events, without running git until something moved.
 * Recursive watching is native on macOS and Windows; on Linux node walks the
 * tree, ignored folders included. Returns how it stops.
 */
export const watchRepo = ({
  gitCommonDir,
  worktree,
  filterIgnored,
  onChange,
  onError,
}: RepoWatchParams): (() => void) => {
  let stopped = false;
  const watchers: FSWatcher[] = [];
  const startedAt = Date.now();
  const isReplay = (): boolean => Date.now() - startedAt < replayWindowMs;

  const gitBatcher = createBatcher(() => {
    if (!stopped) onChange("git");
  });
  const filesBatcher = createBatcher((paths) => {
    filterIgnored(paths)
      .then((kept) => {
        if (!stopped && kept.length > 0) onChange("files");
      })
      .catch(onError);
  });

  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    gitBatcher.stop();
    filesBatcher.stop();
    for (const watcher of watchers) watcher.close();
  };

  const fail = (error: unknown): void => {
    if (stopped) return;
    stop();
    onError(error);
  };

  try {
    const gitWatcher = watch(
      gitCommonDir,
      { recursive: true },
      (_event, filename) => {
        if (filename !== null && !isReplay() && isRefChange(filename)) {
          gitBatcher.add(filename);
        }
      },
    );
    gitWatcher.on("error", fail);
    watchers.push(gitWatcher);

    const filesWatcher = watch(
      worktree,
      { recursive: true },
      (_event, filename) => {
        if (filename !== null && !isReplay() && !isGitPath(filename)) {
          filesBatcher.add(toPosix(filename));
        }
      },
    );
    filesWatcher.on("error", fail);
    watchers.push(filesWatcher);
  } catch (error) {
    fail(error);
  }

  return stop;
};

export interface WatchCheckoutParams {
  /** the listed checkout: its git directory is the one every worktree shares */
  mainCheckout: string;
  /** the working tree whose files are watched: the main checkout or one of its worktrees */
  checkout: string;
  onChange: (change: RepoChange) => void;
  onError: (error: unknown) => void;
}

/** `watchRepo` on a checkout: one git call to find the shared git directory, then none until something moved. */
export const watchCheckout = async ({
  mainCheckout,
  checkout,
  onChange,
  onError,
}: WatchCheckoutParams): Promise<() => void> => {
  const gitCommonDir =
    (await readGitCommonDir(mainCheckout)) ?? join(mainCheckout, ".git");
  return watchRepo({
    gitCommonDir,
    worktree: checkout,
    filterIgnored: (paths) => filterIgnoredPaths(checkout, paths),
    onChange,
    onError,
  });
};
