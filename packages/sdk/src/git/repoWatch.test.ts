import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { RepoChange } from "./repoWatch.ts";
import { isGitPath, isRefChange, watchRepo } from "./repoWatch.ts";

describe("isRefChange", () => {
  test("follows HEADs and refs, never the index, logs, objects or locks", () => {
    expect(isRefChange("HEAD")).toBe(true);
    expect(isRefChange("packed-refs")).toBe(true);
    expect(isRefChange("refs/heads/feat/a")).toBe(true);
    expect(isRefChange("refs\\remotes\\origin\\main")).toBe(true);
    expect(isRefChange("worktrees/fix/HEAD")).toBe(true);
    expect(isRefChange("refs/heads/main.lock")).toBe(false);
    expect(isRefChange("index")).toBe(false);
    expect(isRefChange("worktrees/fix/index")).toBe(false);
    expect(isRefChange("logs/HEAD")).toBe(false);
    expect(isRefChange("objects/ab/cdef")).toBe(false);
  });
});

describe("isGitPath", () => {
  test("tells the repository's own directory from the files", () => {
    expect(isGitPath(".git")).toBe(true);
    expect(isGitPath(".git/index")).toBe(true);
    expect(isGitPath(".github/workflows/ci.yml")).toBe(false);
    expect(isGitPath("src/.git-hooks")).toBe(false);
  });
});

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * The operating system's stream starts asynchronously, and macOS replays what
 * happened just before it: changes count once it is armed.
 */
const armedMs = 500;
const detection = { timeout: 5000 };

describe("watchRepo", () => {
  let root: string | null = null;
  let stop: (() => void) | null = null;

  afterEach(() => {
    stop?.();
    stop = null;
    if (root !== null) rmSync(root, { recursive: true, force: true });
    root = null;
  });

  const start = async (): Promise<{
    changes: RepoChange[];
    gitDir: string;
    worktree: string;
  }> => {
    root = mkdtempSync(join(tmpdir(), "repo-watch-"));
    const gitDir = join(root, "git");
    const worktree = join(root, "worktree");
    mkdirSync(join(gitDir, "refs", "heads"), { recursive: true });
    mkdirSync(join(worktree, "ignored"), { recursive: true });
    const changes: RepoChange[] = [];
    stop = watchRepo({
      gitCommonDir: gitDir,
      worktree,
      filterIgnored: (paths) =>
        Promise.resolve(
          paths.filter(
            (path) => path !== "ignored" && !path.startsWith("ignored/"),
          ),
        ),
      onChange: (change) => changes.push(change),
      onError: (error) => {
        throw error;
      },
    });
    await delay(armedMs);
    return { changes, gitDir, worktree };
  };

  test(
    "reports a moved ref as git, a changed file as files",
    { timeout: 15_000 },
    async () => {
      const { changes, gitDir, worktree } = await start();

      writeFileSync(join(gitDir, "refs", "heads", "feat"), "a".repeat(40));
      await vi.waitFor(() => {
        expect(changes).toContain("git");
      }, detection);
      writeFileSync(join(worktree, "a.txt"), "a\n");
      await vi.waitFor(() => {
        expect(changes).toContain("files");
      }, detection);
    },
  );

  test("stays quiet on what git ignores or keeps for itself", async () => {
    const { changes, gitDir, worktree } = await start();

    writeFileSync(join(worktree, "ignored", "build.js"), "x\n");
    writeFileSync(join(gitDir, "index"), "x\n");
    await delay(1500);
    expect(changes).toEqual([]);
  });
});
