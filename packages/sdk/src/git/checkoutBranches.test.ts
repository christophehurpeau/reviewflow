import { realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  parseTrack,
  parseWorktreeList,
  readBranches,
  readWorktrees,
} from "./checkoutBranches.ts";
import type { GitRepoFixture } from "./test/gitRepo.ts";
import { createGitRepo } from "./test/gitRepo.ts";

let repo: GitRepoFixture | undefined;

afterEach(() => {
  repo?.remove();
  repo = undefined;
});

describe("parseWorktreeList", () => {
  it("reads each block, a detached and an unborn head included", () => {
    expect(
      parseWorktreeList(
        [
          "worktree /repo",
          `HEAD ${"a".repeat(40)}`,
          "branch refs/heads/main",
          "",
          "worktree /repo-fix",
          `HEAD ${"b".repeat(40)}`,
          "detached",
          "locked reason here",
          "",
          "worktree /gone",
          `HEAD ${"0".repeat(40)}`,
          "branch refs/heads/new",
          "prunable gitdir file points to non-existent location",
          "",
        ].join("\n"),
      ),
    ).toEqual([
      {
        path: "/repo",
        branch: "main",
        headSha: "a".repeat(40),
        bare: false,
        lock: null,
        prunable: false,
      },
      {
        path: "/repo-fix",
        branch: null,
        headSha: "b".repeat(40),
        bare: false,
        lock: "reason here",
        prunable: false,
      },
      {
        path: "/gone",
        branch: "new",
        headSha: null,
        bare: false,
        lock: null,
        prunable: true,
      },
    ]);
  });
});

describe("parseTrack", () => {
  it("tells in sync from no upstream, and reads gone", () => {
    expect(parseTrack("", true)).toEqual({ ahead: 0, behind: 0, gone: false });
    expect(parseTrack("", false)).toEqual({
      ahead: null,
      behind: null,
      gone: false,
    });
    expect(parseTrack("[ahead 2, behind 1]", true)).toEqual({
      ahead: 2,
      behind: 1,
      gone: false,
    });
    expect(parseTrack("[behind 3]", true)).toEqual({
      ahead: 0,
      behind: 3,
      gone: false,
    });
    expect(parseTrack("[gone]", true)).toEqual({
      ahead: null,
      behind: null,
      gone: true,
    });
  });
});

describe("readWorktrees", () => {
  it("lists the main checkout first, then a linked worktree with its status", async () => {
    repo = createGitRepo();
    const linked = join(repo.path, "..", "linked");
    repo.git(["worktree", "add", "--quiet", "-b", "fix", linked]);
    writeFileSync(join(linked, "dirty.txt"), "x\n");

    const worktrees = await readWorktrees(repo.path);

    expect(worktrees).toMatchObject([
      { path: repo.path, main: true, branch: "main", prunable: false },
      {
        path: realpathSync(linked),
        main: false,
        branch: "fix",
        status: { untracked: 1 },
      },
    ]);
  });

  it("marks no worktree main in a bare repository", async () => {
    repo = createGitRepo();
    const bare = join(repo.path, "..", "bare.git");
    repo.git(["clone", "--quiet", "--bare", repo.path, bare]);
    const linked = join(repo.path, "..", "from-bare");
    repo.git(["worktree", "add", "--quiet", "-b", "fix", linked], bare);

    const worktrees = await readWorktrees(bare);

    expect(worktrees).toMatchObject([
      { path: realpathSync(linked), main: false, branch: "fix" },
    ]);
  });
});

describe("readBranches", () => {
  it("lists the branches newest first, merged into the base, and where each is checked out", async () => {
    repo = createGitRepo();
    repo.git(["branch", "merged-one"]);
    repo.git(["switch", "--quiet", "-c", "feature"]);
    writeFileSync(join(repo.path, "b.txt"), "b\n");
    repo.git(["add", "b.txt"]);
    repo.git(["commit", "--quiet", "-m", "feat: b"]);

    const { base, branches, worktrees } = await readBranches({
      cwd: repo.path,
      baseName: "main",
    });

    expect(base?.ref).toBe("main");
    expect(worktrees).toHaveLength(1);
    expect(branches[0]).toMatchObject({
      name: "feature",
      merged: false,
      upstream: null,
      ahead: null,
      worktreePath: repo.path,
      lastCommit: { subject: "feat: b" },
    });
    expect(branches.find(({ name }) => name === "merged-one")).toMatchObject({
      merged: true,
      worktreePath: null,
    });
  });

  it("marks nothing merged when the base does not exist", async () => {
    repo = createGitRepo();
    const { base, branches } = await readBranches({
      cwd: repo.path,
      baseName: "develop",
    });
    expect(base).toBeNull();
    expect(branches.every(({ merged }) => !merged)).toBe(true);
  });
});
