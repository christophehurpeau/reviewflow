import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  realpathSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { GitRepoFixture } from "./test/gitRepo.ts";
import { createGitRepo } from "./test/gitRepo.ts";
import {
  completeWorktreeRemoval,
  launcherOf,
  listProcessesInside,
  parseProcessTable,
  prepareWorktreeRemoval,
  readWorktreeRemovalStatus,
} from "./worktreeRemoval.ts";

let repo: GitRepoFixture;

beforeEach(() => {
  repo = createGitRepo();
  // main as pushed: a worktree branched from it starts with nothing of its own
  repo.git(["update-ref", "refs/remotes/origin/main", "main"]);
});

afterEach(() => {
  repo.remove();
});

const addWorktree = (name: string, branch: string | null): string => {
  const path = join(repo.path, "..", name);
  repo.git(
    branch === null
      ? ["worktree", "add", "--quiet", "--detach", path]
      : ["worktree", "add", "--quiet", "-b", branch, path],
  );
  return realpathSync(path);
};

describe("readWorktreeRemovalStatus", () => {
  it("reads a clean linked worktree and its branch", async () => {
    const worktree = addWorktree("linked", "feat");

    expect(await readWorktreeRemovalStatus({ worktree })).toEqual({
      path: worktree,
      main: false,
      branch: "feat",
      modified: 0,
      untracked: 0,
      unpushedCommits: 0,
      lock: null,
      processesInside: expect.any(Array),
      localOnlyIgnored: [],
    });
  });

  it("marks the main checkout", async () => {
    expect(
      await readWorktreeRemovalStatus({ worktree: repo.path }),
    ).toMatchObject({ main: true });
  });

  it("reads this worktree's lock and not a sibling's", async () => {
    const worktree = addWorktree("linked", "feat");
    const sibling = addWorktree("sibling", "other");
    repo.git(["worktree", "lock", "--reason", "sibling lock", sibling]);
    expect(await readWorktreeRemovalStatus({ worktree })).toMatchObject({
      lock: null,
    });

    repo.git(["worktree", "lock", "--reason", "claude session", worktree]);
    expect(await readWorktreeRemovalStatus({ worktree })).toMatchObject({
      lock: "claude session",
    });
    repo.git(["worktree", "unlock", worktree]);
    repo.git(["worktree", "unlock", sibling]);
  });

  it("counts modified and untracked files apart", async () => {
    const worktree = addWorktree("linked", "feat");
    writeFileSync(join(worktree, "tracked.md"), "first");
    repo.git(["add", "tracked.md"], worktree);
    repo.git(["commit", "--quiet", "-m", "chore: add"], worktree);
    writeFileSync(join(worktree, "tracked.md"), "changed");
    writeFileSync(join(worktree, "one.md"), "new");
    writeFileSync(join(worktree, "two.md"), "new");

    expect(await readWorktreeRemovalStatus({ worktree })).toMatchObject({
      modified: 1,
      untracked: 2,
    });
  });

  it("reports no branch on a detached HEAD, and counts its own commits", async () => {
    const worktree = addWorktree("linked", null);
    repo.commit(worktree);

    expect(await readWorktreeRemovalStatus({ worktree })).toMatchObject({
      branch: null,
      unpushedCommits: 1,
    });
  });

  it("does not count a commit another remote branch or a kept sha holds", async () => {
    const worktree = addWorktree("linked", "feat");
    repo.commit(worktree);
    const head = repo.git(["rev-parse", "HEAD"], worktree).trim();
    await expect(
      readWorktreeRemovalStatus({ worktree }),
    ).resolves.toMatchObject({ unpushedCommits: 1 });
    await expect(
      readWorktreeRemovalStatus({ worktree, keptShas: [head] }),
    ).resolves.toMatchObject({ unpushedCommits: 0 });

    repo.git(["update-ref", "refs/remotes/origin/elsewhere", "feat"]);
    await expect(
      readWorktreeRemovalStatus({ worktree }),
    ).resolves.toMatchObject({ unpushedCommits: 0 });
  });

  it("names the ignored paths that exist only in this worktree, a directory as one entry", async () => {
    const worktree = addWorktree("linked", "feat");
    writeFileSync(
      join(worktree, ".gitignore"),
      "*.local\ncache/\nnotes/\nnode_modules/\nios/\n",
    );
    repo.git(["add", ".gitignore"], worktree);
    repo.git(["commit", "--quiet", "-m", "chore: ignore"], worktree);
    repo.git(["update-ref", "refs/remotes/origin/feat", "feat"]);
    writeFileSync(join(worktree, "plan.local"), "only here");
    writeFileSync(join(repo.path, "env.local"), "shared");
    symlinkSync(join(repo.path, "env.local"), join(worktree, "env.local"));
    mkdirSync(join(repo.path, "cache"));
    mkdirSync(join(worktree, "cache"));
    writeFileSync(join(worktree, "cache", "entry"), "regenerable");
    mkdirSync(join(worktree, "notes", "deep"), { recursive: true });
    writeFileSync(join(worktree, "notes", "top.md"), "only here");
    writeFileSync(join(worktree, "notes", "deep", "plan.md"), "only here");
    mkdirSync(join(worktree, "node_modules", "pkg"), { recursive: true });
    writeFileSync(join(worktree, "node_modules", "pkg", "index.js"), "");
    mkdirSync(join(worktree, "ios", "App"), { recursive: true });
    writeFileSync(join(worktree, "ios", "App", "main.swift"), "");
    mkdirSync(join(worktree, "ios", "Pods", "Lib"), { recursive: true });
    writeFileSync(join(worktree, "ios", "Pods", "Lib", "a.m"), "");

    const status = await readWorktreeRemovalStatus({ worktree });

    expect(status.localOnlyIgnored).toEqual([
      { kind: "directory", path: "ios", files: 1 },
      { kind: "directory", path: "notes", files: 2 },
      { kind: "file", path: "plan.local" },
      { kind: "regenerable", path: join("ios", "Pods") },
      { kind: "regenerable", path: "node_modules" },
    ]);
  });
});

describe("listProcessesInside", () => {
  it("names a process whose working directory is inside", async () => {
    const worktree = addWorktree("linked", "feat");
    const before = await listProcessesInside(worktree);
    const child = spawn("sleep", ["30"], { cwd: worktree });
    try {
      // lsof sees the child once it has started
      await new Promise((resolve) => {
        child.once("spawn", resolve);
      });
      const during = await listProcessesInside(worktree);
      expect(before).toEqual([]);
      // launchedBy is whatever runs the suite: a terminal app, tmux or ci
      expect(during).toHaveLength(1);
      expect(during?.[0]).toMatchObject({
        pid: child.pid,
        command: "sleep 30",
        startedAt: expect.any(String),
      });
      const startedAgo = Date.now() - Date.parse(during?.[0]?.startedAt ?? "");
      expect(startedAgo).toBeGreaterThanOrEqual(0);
      expect(startedAgo).toBeLessThan(60_000);
    } finally {
      child.kill();
    }
  });
});

/** Read from a mac whose iTerm2 restored its tabs after a reboot. */
const psTable = `
    1     0 02-04:02:34 /sbin/launchd
  774     1 02-04:01:35 /Applications/iTerm.app/Contents/MacOS/iTerm2
 1161   774 02-04:01:13 /Users/me/Library/Application Support/iTerm2/iTermServer-3.7.7
 1171  1161 02-04:01:13 /usr/bin/login
 1172  1171 02-04:01:13 -zsh
34753  1172    05:42:31 caffeinate
 2166     1 02-04:00:22 /Applications/Visual Studio Code.app/Contents/MacOS/Code
 2190  2166    01:00:00 /Applications/Visual Studio Code.app/Contents/Frameworks/Code Helper (Plugin).app/Contents/MacOS/Code Helper (Plugin)
 2200  2190       00:07 /bin/zsh
 3000     1 01:00:00 tmux
 3001  3000       12:00 -zsh
`;

describe("parseProcessTable", () => {
  it("reads the parent, the elapsed time in every etime form and a path with spaces", () => {
    const table = parseProcessTable(psTable);
    expect(table.get(1161)).toEqual({
      parentPid: 774,
      elapsedSeconds: ((2 * 24 + 4) * 60 + 1) * 60 + 13,
      executable:
        "/Users/me/Library/Application Support/iTerm2/iTermServer-3.7.7",
    });
    expect(table.get(34_753)?.elapsedSeconds).toBe((5 * 60 + 42) * 60 + 31);
    expect(table.get(2200)?.elapsedSeconds).toBe(7);
    expect(table.get(3000)?.elapsedSeconds).toBe(3600);
  });
});

describe("launcherOf", () => {
  const table = parseProcessTable(psTable);

  it("names the first app bundle up the parent chain", () => {
    expect(launcherOf(table, 1172)).toBe("iTerm");
    expect(launcherOf(table, 34_753)).toBe("iTerm");
    expect(launcherOf(table, 2200)).toBe("Visual Studio Code");
  });

  it("names the root of the tree when no app bundle is in it", () => {
    expect(launcherOf(table, 3001)).toBe("tmux");
  });

  it("names nothing for a child of init or an unknown process", () => {
    expect(launcherOf(table, 3000)).toBeNull();
    expect(launcherOf(table, 99_999)).toBeNull();
  });
});

describe("prepareWorktreeRemoval and completeWorktreeRemoval", () => {
  it("refuses the main checkout, a dirty worktree, an unpushed commit and a lock", async () => {
    await expect(
      prepareWorktreeRemoval({ worktree: repo.path, deleteBranch: false }),
    ).rejects.toThrow("main checkout");

    const dirty = addWorktree("dirty", "dirty");
    writeFileSync(join(dirty, "new.md"), "x");
    await expect(
      prepareWorktreeRemoval({ worktree: dirty, deleteBranch: false }),
    ).rejects.toThrow("1 untracked file: git would refuse");

    const ahead = addWorktree("ahead", "ahead");
    repo.commit(ahead);
    await expect(
      prepareWorktreeRemoval({ worktree: ahead, deleteBranch: false }),
    ).rejects.toThrow("1 commit exists only in this clone");

    const locked = addWorktree("locked", "locked");
    repo.git(["worktree", "lock", locked]);
    await expect(
      prepareWorktreeRemoval({ worktree: locked, deleteBranch: false }),
    ).rejects.toThrow("git holds this worktree locked,");
    repo.git(["worktree", "unlock", locked]);
  });

  it("removes a clean worktree and deletes its merged branch", async () => {
    const worktree = addWorktree("linked", "feat");

    const plan = await prepareWorktreeRemoval({
      worktree,
      deleteBranch: true,
    });
    const result = await completeWorktreeRemoval(plan);

    expect(result).toEqual({
      path: worktree,
      branch: "feat",
      branchError: null,
    });
    expect(existsSync(worktree)).toBe(false);
    expect(repo.git(["branch", "--list", "feat"]).trim()).toBe("");
  });

  it("keeps the removal when git refuses to delete an unmerged branch", async () => {
    const worktree = addWorktree("linked", "feat");
    repo.commit(worktree);
    const head = repo.git(["rev-parse", "HEAD"], worktree).trim();

    const plan = await prepareWorktreeRemoval({
      worktree,
      keptShas: [head],
      deleteBranch: true,
    });
    const result = await completeWorktreeRemoval(plan);

    expect(existsSync(worktree)).toBe(false);
    expect(result.branch).toBe("feat");
    expect(result.branchError).toContain("not fully merged");
    expect(repo.git(["branch", "--list", "feat"]).trim()).toContain("feat");
  });

  it("leaves the branch alone unless asked", async () => {
    const worktree = addWorktree("linked", "feat");
    const result = await completeWorktreeRemoval(
      await prepareWorktreeRemoval({ worktree, deleteBranch: false }),
    );
    expect(result.branch).toBeNull();
    expect(repo.git(["branch", "--list", "feat"]).trim()).toContain("feat");
  });
});
