import { realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { filterIgnoredPaths, readGitCommonDir } from "./ignoredPaths.ts";
import type { GitRepoFixture } from "./test/gitRepo.ts";
import { createGitRepo } from "./test/gitRepo.ts";

let repo: GitRepoFixture | undefined;

afterEach(() => {
  repo?.remove();
  repo = undefined;
});

describe("filterIgnoredPaths", () => {
  it("keeps what git does not ignore, all of it when nothing is", async () => {
    repo = createGitRepo();
    writeFileSync(join(repo.path, ".gitignore"), "dist/\n");

    expect(
      await filterIgnoredPaths(repo.path, ["dist/a.js", "src/a.ts"]),
    ).toEqual(["src/a.ts"]);
    expect(await filterIgnoredPaths(repo.path, ["src/a.ts"])).toEqual([
      "src/a.ts",
    ]);
    expect(await filterIgnoredPaths(repo.path, [])).toEqual([]);
  });
});

describe("readGitCommonDir", () => {
  it("names the main checkout's git directory, from a linked worktree too", async () => {
    repo = createGitRepo();
    const linked = join(repo.path, "..", "linked");
    repo.git(["worktree", "add", "--quiet", "-b", "fix", linked]);

    const expected = join(realpathSync(repo.path), ".git");
    expect(await readGitCommonDir(repo.path)).toBe(expected);
    expect(await readGitCommonDir(linked)).toBe(expected);
  });
});
