import { describe, expect, it } from "vitest";
import type { WorktreeRemovalStatus } from "./worktreeRemoval.ts";
import {
  mainWorktreeRefusal,
  worktreeRemovalRefusal,
  worktreeRemovalRefusals,
} from "./worktreeRemoval.ts";

const status = (
  overrides: Partial<WorktreeRemovalStatus>,
): WorktreeRemovalStatus => ({
  path: "/w",
  main: false,
  branch: "feat",
  modified: 0,
  untracked: 0,
  unpushedCommits: 0,
  lock: null,
  processesInside: 0,
  localOnlyIgnored: [],
  ...overrides,
});

describe("worktreeRemovalRefusals", () => {
  it("lets a clean worktree go, ignored files and an unknown process count included", () => {
    expect(
      worktreeRemovalRefusals(
        status({ localOnlyIgnored: ["plan.md"], processesInside: null }),
      ),
    ).toEqual([]);
    expect(worktreeRemovalRefusal(status({}))).toBeNull();
  });

  it("refuses the main checkout before anything else", () => {
    expect(
      worktreeRemovalRefusals(status({ main: true, modified: 3 })),
    ).toEqual([mainWorktreeRefusal]);
  });

  it("names every reason, in the order to act on them", () => {
    expect(
      worktreeRemovalRefusals(
        status({
          modified: 1,
          untracked: 2,
          unpushedCommits: 3,
          lock: "",
          processesInside: 1,
        }),
      ),
    ).toEqual([
      "1 modified file and 2 untracked files: git would refuse to remove this worktree. Commit or discard them first.",
      "3 commits exist only in this clone, on no remote branch and in no pull request. Push them first.",
      "git holds this worktree locked, usually by a Claude Code process still running in it. Exit it first.",
      "1 process runs inside this worktree (a shell, an editor or an agent): removing it would pull the directory out from under them. Exit them first.",
    ]);
  });

  it("names the lock's reason when git has one", () => {
    expect(worktreeRemovalRefusal(status({ lock: "claude session" }))).toBe(
      "git holds this worktree locked (claude session), usually by a Claude Code process still running in it. Exit it first.",
    );
  });
});
