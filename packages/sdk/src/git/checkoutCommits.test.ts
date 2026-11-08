import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readCommitDiff, readRecentCommits } from "./checkoutCommits.ts";
import type { GitRepoFixture } from "./test/gitRepo.ts";
import { createGitRepo } from "./test/gitRepo.ts";

let repo: GitRepoFixture | undefined;

afterEach(() => {
  repo?.remove();
  repo = undefined;
});

const commitFile = (
  fixture: GitRepoFixture,
  path: string,
  contents: string,
  message: string,
): string => {
  writeFileSync(join(fixture.path, path), contents);
  fixture.git(["add", path]);
  fixture.git(["commit", "--quiet", "-m", message]);
  return fixture.git(["rev-parse", "HEAD"]).trim();
};

describe("readRecentCommits", () => {
  it("lists HEAD newest first and marks the branch's own commits", async () => {
    repo = createGitRepo({ initialCommit: false });
    const first = commitFile(repo, "a.txt", "a\n", "feat: a");
    repo.git(["switch", "--quiet", "-c", "feature"]);
    const second = commitFile(
      repo,
      "a.txt",
      "a\nb\n",
      "feat: b\n\nwhy b matters",
    );

    const { branch, base, onBranchCount, commits } = await readRecentCommits({
      cwd: repo.path,
      baseName: "main",
    });

    expect(branch).toBe("feature");
    expect(base?.ref).toBe("main");
    expect(onBranchCount).toBe(1);
    expect(commits).toMatchObject([
      {
        oid: second,
        parentOid: first,
        merge: false,
        headline: "feat: b",
        body: "why b matters",
        author: { login: "reviewflow test", avatarUrl: null },
        onBranch: true,
        pushed: false,
      },
      { oid: first, parentOid: null, headline: "feat: a", onBranch: false },
    ]);
  });

  it("lists a local branch that is not checked out, its own commits marked", async () => {
    repo = createGitRepo({ initialCommit: false });
    const first = commitFile(repo, "a.txt", "a\n", "feat: a");
    repo.git(["switch", "--quiet", "-c", "feature"]);
    const second = commitFile(repo, "a.txt", "a\nb\n", "feat: b");
    repo.git(["switch", "--quiet", "main"]);

    const { branch, onBranchCount, commits } = await readRecentCommits({
      cwd: repo.path,
      baseName: "main",
      branch: "feature",
    });

    expect(branch).toBe("feature");
    expect(onBranchCount).toBe(1);
    expect(commits).toMatchObject([
      { oid: second, onBranch: true },
      { oid: first, onBranch: false },
    ]);
  });

  it("marks the commits no remote-tracking ref reaches as not pushed", async () => {
    repo = createGitRepo({ initialCommit: false });
    const first = commitFile(repo, "a.txt", "a\n", "feat: a");
    repo.git(["update-ref", "refs/remotes/origin/main", first]);
    const second = commitFile(repo, "a.txt", "a\nb\n", "feat: b");

    const { commits } = await readRecentCommits({ cwd: repo.path });

    expect(commits.map(({ oid, pushed }) => ({ oid, pushed }))).toEqual([
      { oid: second, pushed: false },
      { oid: first, pushed: true },
    ]);
  });

  it("marks nothing pushed or not in a checkout without a remote", async () => {
    repo = createGitRepo({ remote: null });
    const { commits } = await readRecentCommits({ cwd: repo.path });
    expect(commits[0]?.pushed).toBeNull();
  });

  it("keeps the commits but marks none when the base does not exist", async () => {
    repo = createGitRepo();
    const { base, onBranchCount, commits } = await readRecentCommits({
      cwd: repo.path,
      baseName: "develop",
    });
    expect(base).toBeNull();
    expect(onBranchCount).toBeNull();
    expect(commits).toHaveLength(1);
    expect(commits[0]?.onBranch).toBe(false);
  });

  it("has no commit in a repository without one", async () => {
    repo = createGitRepo({ initialCommit: false });
    const { commits } = await readRecentCommits({ cwd: repo.path });
    expect(commits).toEqual([]);
  });

  it("stops at the limit", async () => {
    repo = createGitRepo();
    repo.commit();
    repo.commit();
    const { commits } = await readRecentCommits({ cwd: repo.path, limit: 2 });
    expect(commits).toHaveLength(2);
  });
});

describe("readCommitDiff", () => {
  it("diffs a commit against its parent", async () => {
    repo = createGitRepo({ initialCommit: false });
    const first = commitFile(repo, "a.txt", "a\n", "feat: a");
    const second = commitFile(repo, "a.txt", "a\nb\n", "feat: b");

    const diff = await readCommitDiff({ cwd: repo.path, sha: second });

    expect(diff.parentSha).toBe(first);
    expect(diff.groups).toEqual([{ name: "", paths: ["a.txt"] }]);
    expect(diff.patch).toContain("+b");
    expect(diff.patch).not.toContain("+a");
  });

  it("diffs a root commit against the empty tree", async () => {
    repo = createGitRepo({ initialCommit: false });
    const first = commitFile(repo, "a.txt", "a\n", "feat: a");

    const diff = await readCommitDiff({ cwd: repo.path, sha: first });

    expect(diff.parentSha).toBeNull();
    expect(diff.patch).toContain("+a");
  });

  it("refuses what names no commit", async () => {
    repo = createGitRepo();
    await expect(
      readCommitDiff({ cwd: repo.path, sha: "f".repeat(40) }),
    ).rejects.toThrow("failed");
  });
});
