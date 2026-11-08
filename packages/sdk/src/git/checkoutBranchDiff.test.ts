import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  readCheckoutBranchDiff,
  readDefaultBranch,
  readHeadBranch,
} from "./checkoutBranchDiff.ts";
import type { GitRepoFixture } from "./test/gitRepo.ts";
import { createGitRepo } from "./test/gitRepo.ts";

let repo: GitRepoFixture | undefined;

afterEach(() => {
  repo?.remove();
  repo = undefined;
});

/** `main` with one file, then `feature` changing it in a commit, plus an untracked file. */
const createFeatureBranch = (): GitRepoFixture => {
  const fixture = createGitRepo();
  writeFileSync(join(fixture.path, "a.txt"), "a\n");
  fixture.git(["add", "a.txt"]);
  fixture.commit();
  fixture.git(["switch", "--quiet", "-c", "feature"]);
  writeFileSync(join(fixture.path, "a.txt"), "a\nb\n");
  fixture.git(["commit", "--quiet", "-am", "feat: b"]);
  writeFileSync(join(fixture.path, "new.txt"), "new\n");
  return fixture;
};

describe("readDefaultBranch", () => {
  it("is null while origin/HEAD was never recorded", async () => {
    repo = createGitRepo();
    await expect(readDefaultBranch(repo.path)).resolves.toBeNull();
  });

  it("names the branch origin/HEAD points at", async () => {
    repo = createGitRepo({ branch: "trunk" });
    repo.git(["update-ref", "refs/remotes/origin/trunk", "HEAD"]);
    repo.git([
      "symbolic-ref",
      "refs/remotes/origin/HEAD",
      "refs/remotes/origin/trunk",
    ]);
    await expect(readDefaultBranch(repo.path)).resolves.toBe("trunk");
  });
});

describe("readHeadBranch", () => {
  it("is null on a detached HEAD", async () => {
    repo = createGitRepo();
    repo.git(["switch", "--quiet", "--detach"]);
    await expect(readHeadBranch(repo.path)).resolves.toBeNull();
  });
});

describe("readCheckoutBranchDiff", () => {
  it("diffs the branch's commits against the local base, leaving the working tree out", async () => {
    repo = createFeatureBranch();
    const diff = await readCheckoutBranchDiff({
      cwd: repo.path,
      baseName: "main",
      scope: "committed",
    });

    expect(diff.branch).toBe("feature");
    expect(diff.base).toEqual({
      name: "main",
      ref: "main",
      sha: repo.git(["rev-parse", "main"]).trim(),
    });
    expect(diff.untrackedCount).toBe(0);
    expect(diff.groups).toEqual([{ name: "", paths: ["a.txt"] }]);
    expect(diff.patch).toContain("+b");
  });

  it("diffs the working tree against HEAD under the uncommitted scope, with no base", async () => {
    repo = createFeatureBranch();
    writeFileSync(join(repo.path, "a.txt"), "a\nb\nc\n");
    const diff = await readCheckoutBranchDiff({
      cwd: repo.path,
      baseName: "develop",
      scope: "uncommitted",
    });

    expect(diff.base).toBeNull();
    expect(diff.mergeBase).toBeNull();
    expect(diff.untrackedCount).toBe(1);
    expect(diff.groups).toEqual([{ name: "", paths: ["a.txt", "new.txt"] }]);
    expect(diff.patch).toContain("+c");
    expect(diff.patch).not.toContain("+b");
  });

  it("prefers origin/<base>, the default branch when none is named", async () => {
    repo = createFeatureBranch();
    repo.git(["update-ref", "refs/remotes/origin/main", "main"]);
    repo.git([
      "symbolic-ref",
      "refs/remotes/origin/HEAD",
      "refs/remotes/origin/main",
    ]);
    const diff = await readCheckoutBranchDiff({
      cwd: repo.path,
      scope: "committed",
    });

    expect(diff.base?.ref).toBe("origin/main");
  });

  it("names the refs it looked for when the base does not exist", async () => {
    repo = createFeatureBranch();
    await expect(
      readCheckoutBranchDiff({
        cwd: repo.path,
        baseName: "develop",
        scope: "committed",
      }),
    ).rejects.toThrow("neither origin/develop nor develop exists");
  });
});
