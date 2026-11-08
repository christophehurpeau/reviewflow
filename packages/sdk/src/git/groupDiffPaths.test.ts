import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  groupDiffPaths,
  noPackages,
  packagesAtTree,
  packagesOnDisk,
} from "./groupDiffPaths.ts";
import type { GitRepoFixture } from "./test/gitRepo.ts";
import { createGitRepo } from "./test/gitRepo.ts";

let repo: GitRepoFixture;

beforeEach(() => {
  repo = createGitRepo();
});

afterEach(() => {
  repo.remove();
});

const write = (path: string, content: string): void => {
  mkdirSync(dirname(join(repo.path, path)), { recursive: true });
  writeFileSync(join(repo.path, path), content);
};

const paths = [
  ".claude/rules/a.md",
  "apps/resident/src/b.ts",
  "apps/resident/src/deep/c.ts",
  "README.md",
  "services/api/src/app/main.py",
];

const expected = [
  { name: ".claude", paths: [".claude/rules/a.md"] },
  {
    name: "apps/resident",
    paths: ["apps/resident/src/b.ts", "apps/resident/src/deep/c.ts"],
  },
  { name: "services/api", paths: ["services/api/src/app/main.py"] },
  { name: "", paths: ["README.md"] },
];

describe("groupDiffPaths", () => {
  /** The shape of a monorepo: a dotted root directory beside a workspace app. */
  it("groups by the nearest package, else the first directory, else the root, root last", () => {
    const manifests = new Set(["apps/resident", "services/api"]);

    expect(
      groupDiffPaths((directory) => manifests.has(directory), paths),
    ).toEqual(expected);
  });

  it("groups by first directory when no package is known", () => {
    expect(groupDiffPaths(noPackages, ["a/b/c.ts", "a/d.ts", "e.md"])).toEqual([
      { name: "a", paths: ["a/b/c.ts", "a/d.ts"] },
      { name: "", paths: ["e.md"] },
    ]);
  });
});

describe("packagesAtTree", () => {
  it("knows the directories holding a manifest at the commit, not the root", async () => {
    write("package.json", "{}\n");
    write("apps/resident/package.json", "{}\n");
    write("services/api/pyproject.toml", "[project]\n");
    write("docs/package.json.md", "not a manifest\n");
    repo.git(["add", "-A"]);
    repo.commit();
    const sha = repo.git(["rev-parse", "HEAD"]).trim();

    const isPackage = await packagesAtTree(repo.path, sha);

    expect(isPackage("apps/resident")).toBe(true);
    expect(isPackage("services/api")).toBe(true);
    expect(isPackage("")).toBe(false);
    expect(isPackage("docs")).toBe(false);
    expect(isPackage("apps")).toBe(false);
    expect(groupDiffPaths(isPackage, paths)).toEqual(expected);
  });

  /** The checkout may have another branch out: the head's tree decides. */
  it("reads the commit's tree rather than the working tree", async () => {
    write("apps/resident/package.json", "{}\n");
    repo.git(["add", "-A"]);
    repo.commit();
    const sha = repo.git(["rev-parse", "HEAD"]).trim();
    repo.git(["rm", "--quiet", "-r", "apps"]);
    repo.commit();

    expect((await packagesAtTree(repo.path, sha))("apps/resident")).toBe(true);
    expect((await packagesAtTree(repo.path, "HEAD"))("apps/resident")).toBe(
      false,
    );
  });

  it("rejects a commit the checkout does not have", async () => {
    await expect(
      packagesAtTree(repo.path, "0123456789abcdef0123456789abcdef01234567"),
    ).rejects.toThrow(/git ls-tree/);
  });
});

describe("packagesOnDisk", () => {
  it("reads manifests from the working tree, uncommitted ones included", () => {
    write("apps/resident/package.json", "{}\n");
    write("package.json", "{}\n");

    const isPackage = packagesOnDisk(repo.path);

    expect(isPackage("apps/resident")).toBe(true);
    expect(isPackage("apps")).toBe(false);
  });
});
