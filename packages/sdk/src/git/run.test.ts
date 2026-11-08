import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { catFiles, git } from "./run.ts";
import type { GitRepoFixture } from "./test/gitRepo.ts";
import { createGitRepo } from "./test/gitRepo.ts";

describe("git uninterruptible", () => {
  let repo: GitRepoFixture | undefined;

  afterEach(() => {
    repo?.remove();
    repo = undefined;
  });

  it("answers git's stdout", async () => {
    repo = createGitRepo();
    await expect(
      git(repo.path, ["rev-parse", "--is-inside-work-tree"], {
        uninterruptible: true,
      }),
    ).resolves.toBe("true\n");
  });

  it("fails with git's reason and the command", async () => {
    repo = createGitRepo();
    await expect(
      git(repo.path, ["rev-parse", "--verify", "no-such-ref"], {
        uninterruptible: true,
      }),
    ).rejects.toThrow(
      `git rev-parse --verify no-such-ref failed in ${repo.path}: fatal: Needed a single revision`,
    );
  });
});

describe("catFiles", () => {
  let repo: GitRepoFixture | undefined;

  afterEach(() => {
    repo?.remove();
    repo = undefined;
  });

  const commitFiles = (files: Record<string, string>): string => {
    repo = createGitRepo();
    for (const [path, content] of Object.entries(files)) {
      writeFileSync(join(repo.path, path), content);
    }
    repo.git(["add", "."]);
    repo.commit();
    return repo.git(["rev-parse", "HEAD"]).trim();
  };

  it("reads the files after a missing path containing one space", async () => {
    const sha = commitFiles({ "a.txt": "a\n", "with space.txt": "w\n" });

    const contents = await catFiles(repo!.path, sha, [
      "new file.ts",
      "a.txt",
      "missing two spaces.ts",
      "with space.txt",
    ]);

    expect(contents).toEqual(
      new Map([
        ["a.txt", "a\n"],
        ["with space.txt", "w\n"],
      ]),
    );
  });

  it("skips a path naming a tree", async () => {
    const sha = commitFiles({ "a.txt": "a\n" });
    const contents = await catFiles(repo!.path, sha, ["", "a.txt"]);

    expect(contents.get("a.txt")).toBe("a\n");
    expect(contents.has("")).toBe(false);
  });

  it("rejects without crashing when git exits before reading its input", async () => {
    const notARepo = mkdtempSync(join(tmpdir(), "reviewflow-not-a-repo-"));
    try {
      const paths = Array.from(
        { length: 5000 },
        (_, index) => `some/long/path/to/file-${String(index)}.ts`,
      );
      await expect(
        catFiles(notARepo, "0".repeat(40), paths),
      ).rejects.toMatchObject({ code: "ERR_GIT_FAILED" });
    } finally {
      rmSync(notARepo, { recursive: true, force: true });
    }
  });
});
