import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  defaultDiffLimits,
  parseNumstat,
  parseRawNumstat,
  readBranchDiff,
} from "./readBranchDiff.ts";
import type { GitRepoFixture } from "./test/gitRepo.ts";
import { createGitRepo } from "./test/gitRepo.ts";

let repo: GitRepoFixture;

beforeEach(() => {
  repo = createGitRepo();
});

afterEach(() => {
  repo.remove();
});

const write = (path: string, content: Buffer | string): void => {
  mkdirSync(dirname(join(repo.path, path)), { recursive: true });
  writeFileSync(join(repo.path, path), content);
};

const commitFile = (path: string, content: string): void => {
  write(path, content);
  repo.git(["add", "--", path]);
  repo.commit();
};

const rev = (name: string): string => repo.git(["rev-parse", name]).trim();

/** Branches off main, runs `change`, and reads the branch against main. */
const readBranch = async (
  change: () => void,
  options: Partial<Parameters<typeof readBranchDiff>[0]> = {},
): ReturnType<typeof readBranchDiff> => {
  const mergeBase = rev("main");
  repo.git(["checkout", "--quiet", "-b", "feat"]);
  change();
  return readBranchDiff({
    cwd: repo.path,
    mergeBase,
    head: rev("HEAD"),
    ...options,
  });
};

/** The paths a patch names, in order, from its `diff --git` headers. */
const patchPaths = (patch: string): string[] =>
  [...patch.matchAll(/^diff --git a\/\S+ b\/(\S+)$/gm)].map(
    ([, path]) => path ?? "",
  );

describe("readBranchDiff", () => {
  it("diffs from the merge base to the head, leaving out what landed on the base since", async () => {
    commitFile("base.txt", "base\n");
    const mergeBase = rev("main");
    repo.git(["checkout", "--quiet", "-b", "feat"]);
    commitFile("feature.txt", "feature\n");
    const head = rev("HEAD");
    repo.git(["checkout", "--quiet", "main"]);
    commitFile("later.txt", "later\n");

    const diff = await readBranchDiff({ cwd: repo.path, mergeBase, head });

    expect(patchPaths(diff.patch)).toEqual(["feature.txt"]);
    expect(diff.paths).toEqual(["feature.txt"]);
    expect(diff.omitted).toEqual([]);
  });

  it("keeps a/ and b/ prefixes and no colour whatever the user's config", async () => {
    repo.git(["config", "diff.noprefix", "true"]);
    repo.git(["config", "diff.mnemonicPrefix", "true"]);
    repo.git(["config", "color.ui", "always"]);
    repo.git(["config", "core.quotePath", "true"]);

    const diff = await readBranch(() => {
      commitFile("é dir/file.txt", "content\n");
    });

    expect(diff.patch).toContain(
      "diff --git a/é dir/file.txt b/é dir/file.txt",
    );
    expect(diff.patch).not.toContain("\u001B[");
  });

  it("lists binary and oversized files as omitted and leaves them out of the patch", async () => {
    const diff = await readBranch(
      () => {
        write("image.bin", Buffer.from([0, 1, 2, 0, 255]));
        write("big.txt", "line\n".repeat(20));
        write("small.txt", "line\n");
        repo.git(["add", "-A"]);
        repo.commit();
      },
      { limits: { ...defaultDiffLimits, maxLinesPerFile: 10 } },
    );

    expect(patchPaths(diff.patch)).toEqual(["small.txt"]);
    expect(diff.omitted).toEqual([
      { path: "big.txt", reason: "tooLarge" },
      { path: "image.bin", reason: "binary" },
    ]);
  });

  it("stops at the total budget and says so per file", async () => {
    const diff = await readBranch(
      () => {
        write("a.txt", "line\n".repeat(5));
        write("b.txt", "line\n".repeat(5));
        repo.git(["add", "-A"]);
        repo.commit();
      },
      { limits: { ...defaultDiffLimits, maxTotalLines: 8 } },
    );

    expect(patchPaths(diff.patch)).toEqual(["a.txt"]);
    expect(diff.omitted).toEqual([{ path: "b.txt", reason: "budget" }]);
  });

  /**
   * `git diff -w` names no file whose every change is whitespace, so it is
   * listed apart; a file with a real change keeps it and loses the rest.
   */
  it("hides whitespace changes and lists the files that had nothing else", async () => {
    commitFile("indented.ts", "if (a) {\nb();\n}\n");
    commitFile("mixed.ts", "one\ntwo\n");
    const change = (): void => {
      write("indented.ts", "if (a) {\n  b();\n}\n");
      write("mixed.ts", "one  \nthree\n");
      repo.git(["add", "-A"]);
      repo.commit();
    };
    const shown = await readBranch(change);
    const hidden = await readBranchDiff({
      cwd: repo.path,
      mergeBase: rev("main"),
      head: rev("HEAD"),
      whitespace: "hide",
    });

    expect(patchPaths(shown.patch)).toEqual(["indented.ts", "mixed.ts"]);
    expect(shown.omitted).toEqual([]);
    expect(patchPaths(hidden.patch)).toEqual(["mixed.ts"]);
    expect(hidden.patch).toContain("+three");
    expect(hidden.patch).not.toContain("-one");
    expect(hidden.omitted).toEqual([
      { path: "indented.ts", reason: "whitespace" },
    ]);
  });
});

describe("readBranchDiff under the workingTree scope", () => {
  const readAll = async (
    change: () => void,
    options: Partial<Parameters<typeof readBranchDiff>[0]> = {},
  ): ReturnType<typeof readBranchDiff> => {
    const mergeBase = rev("main");
    repo.git(["checkout", "--quiet", "-b", "feat"]);
    change();
    return readBranchDiff({
      cwd: repo.path,
      mergeBase,
      scope: "workingTree",
      ...options,
    });
  };

  it("adds uncommitted and untracked work, and only under `all`", async () => {
    commitFile("tracked.txt", "one\n");
    const mergeBase = rev("main");
    repo.git(["checkout", "--quiet", "-b", "feat"]);
    commitFile("committed.txt", "committed\n");
    write("tracked.txt", "one\ntwo\n");
    write("notes/untracked.txt", "new\n");

    const committed = await readBranchDiff({
      cwd: repo.path,
      mergeBase,
      scope: "committed",
    });
    const all = await readBranchDiff({
      cwd: repo.path,
      mergeBase,
      scope: "workingTree",
    });

    expect(patchPaths(committed.patch)).toEqual(["committed.txt"]);
    expect(committed.untrackedCount).toBe(0);
    expect(patchPaths(all.patch)).toEqual([
      "committed.txt",
      "tracked.txt",
      "notes/untracked.txt",
    ]);
    expect(all.paths).toEqual([
      "committed.txt",
      "tracked.txt",
      "notes/untracked.txt",
    ]);
    expect(all.untrackedCount).toBe(1);
    expect(all.patch).toContain("--- /dev/null");
    expect(all.patch).toContain("+++ b/notes/untracked.txt");
  });

  it("ends the committed scope at HEAD unless a head is given", async () => {
    const mergeBase = rev("main");
    repo.git(["checkout", "--quiet", "-b", "feat"]);
    commitFile("first.txt", "first\n");
    const first = rev("HEAD");
    commitFile("second.txt", "second\n");

    const atHead = await readBranchDiff({ cwd: repo.path, mergeBase });
    const atFirst = await readBranchDiff({
      cwd: repo.path,
      mergeBase,
      head: first,
    });

    expect(patchPaths(atHead.patch)).toEqual(["first.txt", "second.txt"]);
    expect(patchPaths(atFirst.patch)).toEqual(["first.txt"]);
  });

  it("never writes the index, and leaves ignored files out", async () => {
    commitFile(".gitignore", "ignored.txt\n");
    const diff = await readAll(() => {
      write("untracked.txt", "new\n");
      write("ignored.txt", "ignored\n");
    });

    expect(patchPaths(diff.patch)).toEqual(["untracked.txt"]);
    expect(repo.git(["status", "--porcelain"])).toBe("?? untracked.txt\n");
    expect(repo.git(["diff", "--cached", "--name-only"])).toBe("");
  });

  it("names an untracked file as it is on disk, whatever the user's config", async () => {
    repo.git(["config", "diff.noprefix", "true"]);
    repo.git(["config", "color.ui", "always"]);
    const diff = await readAll(() => {
      write("é dir/file.txt", "content\n");
    });

    expect(diff.patch).toContain(
      "diff --git a/é dir/file.txt b/é dir/file.txt",
    );
    expect(diff.patch).not.toContain("\u001B[");
  });

  it("lists an oversized, a too long and a binary untracked file as omitted", async () => {
    const diff = await readAll(
      () => {
        write("small.txt", "line\n");
        write("long.txt", "line\n".repeat(20));
        write("heavy.txt", "x".repeat(200));
        write("image.bin", Buffer.from([0, 1, 2, 0, 255]));
      },
      {
        limits: {
          ...defaultDiffLimits,
          maxLinesPerFile: 10,
          maxUntrackedBytes: 150,
        },
      },
    );

    expect(patchPaths(diff.patch)).toEqual(["small.txt"]);
    expect(diff.untrackedCount).toBe(1);
    expect(diff.omitted).toEqual([
      { path: "heavy.txt", reason: "tooLarge" },
      { path: "image.bin", reason: "binary" },
      { path: "long.txt", reason: "tooLarge" },
    ]);
  });

  it("reads at most maxUntrackedFiles untracked files and lists the rest as budget", async () => {
    const diff = await readAll(
      () => {
        write("a.txt", "a\n");
        write("b.txt", "b\n");
        write("c.txt", "c\n");
      },
      { limits: { ...defaultDiffLimits, maxUntrackedFiles: 2 } },
    );

    expect(patchPaths(diff.patch)).toEqual(["a.txt", "b.txt"]);
    expect(diff.untrackedCount).toBe(2);
    expect(diff.omitted).toEqual([{ path: "c.txt", reason: "budget" }]);
  });

  it("counts untracked files against the same total budget as tracked ones", async () => {
    const diff = await readAll(
      () => {
        commitFile("a.txt", "line\n".repeat(5));
        write("b.txt", "line\n".repeat(5));
      },
      { limits: { ...defaultDiffLimits, maxTotalLines: 8 } },
    );

    expect(patchPaths(diff.patch)).toEqual(["a.txt"]);
    expect(diff.untrackedCount).toBe(0);
    expect(diff.omitted).toEqual([{ path: "b.txt", reason: "budget" }]);
  });

  it("names the shown files rather than the omitted ones when those are more", async () => {
    const diff = await readBranch(
      () => {
        commitFile("kept.txt", "line\n");
        for (let index = 0; index < 20; index++) {
          write(`many/${String(index)}.txt`, "line\n");
        }
        repo.git(["add", "-A"]);
        repo.commit();
      },
      { limits: { ...defaultDiffLimits, maxFiles: 1 } },
    );

    expect(patchPaths(diff.patch)).toEqual(["kept.txt"]);
    expect(diff.omitted).toHaveLength(20);
  });

  it("keeps a rename whole when it names the shown files", async () => {
    commitFile("old.txt", "same\n".repeat(20));
    const diff = await readBranch(
      () => {
        repo.git(["mv", "old.txt", "new.txt"]);
        write("z1.txt", "line\n");
        write("z2.txt", "line\n");
        repo.git(["add", "-A"]);
        repo.commit();
      },
      { limits: { ...defaultDiffLimits, maxFiles: 1 } },
    );

    expect(diff.paths).toEqual(["new.txt"]);
    expect(diff.patch).toContain("rename from old.txt");
  });

  it("reads nothing when every file is omitted", async () => {
    const diff = await readBranch(() => {
      write("image.bin", Buffer.from([0, 1, 2, 0]));
      repo.git(["add", "-A"]);
      repo.commit();
    });

    expect(diff.patch).toBe("");
    expect(diff.omitted).toEqual([{ path: "image.bin", reason: "binary" }]);
  });

  it("skips an untracked nested repository and counts an empty untracked file as no line", async () => {
    const diff = await readAll(() => {
      mkdirSync(join(repo.path, "nested"));
      repo.git(["init", "--quiet"], join(repo.path, "nested"));
      write("nested/inside.txt", "a\n");
      write("empty.txt", "");
    });

    expect(diff.paths).toEqual(["empty.txt"]);
    expect(diff.untrackedCount).toBe(1);
    expect(diff.omitted).toEqual([]);
  });

  it("refuses a revision that would read as an option", async () => {
    await expect(
      readBranchDiff({ cwd: repo.path, mergeBase: "--output=/tmp/x" }),
    ).rejects.toThrow("not a revision: --output=/tmp/x");
    await expect(
      readBranchDiff({ cwd: repo.path, mergeBase: rev("HEAD"), head: "-p" }),
    ).rejects.toThrow("not a revision: -p");
  });
});

describe("readBranchDiff's files", () => {
  it("gives each committed file its status and counts, the omitted ones too", async () => {
    commitFile("edited.txt", "a\nb\n");
    commitFile("gone.txt", "gone\n");
    commitFile("old name.txt", "same\n".repeat(20));
    commitFile("image.bin", "\0one");
    const diff = await readBranch(() => {
      write("edited.txt", "a\nc\nd\n");
      repo.git(["rm", "--quiet", "gone.txt"]);
      repo.git(["mv", "old name.txt", "new name.txt"]);
      write("new name.txt", `${"same\n".repeat(20)}more\n`);
      write(":colon.txt", "x\n");
      write("image.bin", "\0two");
      write("added.bin", Buffer.from([0, 1, 2, 0]));
      repo.git(["add", "-A"]);
      repo.commit();
    });

    expect(diff.files).toEqual([
      {
        path: ":colon.txt",
        previousPath: null,
        status: "added",
        additions: 1,
        deletions: 0,
      },
      {
        path: "edited.txt",
        previousPath: null,
        status: "modified",
        additions: 2,
        deletions: 1,
      },
      {
        path: "gone.txt",
        previousPath: null,
        status: "deleted",
        additions: 0,
        deletions: 1,
      },
      {
        path: "new name.txt",
        previousPath: "old name.txt",
        status: "renamed",
        additions: 1,
        deletions: 0,
      },
      {
        path: "added.bin",
        previousPath: null,
        status: "added",
        additions: null,
        deletions: null,
      },
      {
        path: "image.bin",
        previousPath: null,
        status: "modified",
        additions: null,
        deletions: null,
      },
    ]);
    expect(diff.files.map(({ path }) => path)).toEqual([
      ...diff.paths,
      ...diff.omitted.map(({ path }) => path),
    ]);
  });

  it("counts a file left out for its whitespace without hiding it", async () => {
    commitFile("indented.ts", "if (a) {\nb();\n}\n");
    commitFile("mixed.ts", "one\ntwo\n");
    const diff = await readBranch(
      () => {
        write("indented.ts", "if (a) {\n  b();\n}\n");
        write("mixed.ts", "one  \nthree\n");
        repo.git(["add", "-A"]);
        repo.commit();
      },
      { whitespace: "hide" },
    );

    expect(diff.files).toEqual([
      {
        path: "mixed.ts",
        previousPath: null,
        status: "modified",
        additions: 1,
        deletions: 1,
      },
      {
        path: "indented.ts",
        previousPath: null,
        status: "modified",
        additions: 1,
        deletions: 1,
      },
    ]);
  });

  it("adds the working tree's files, an untracked one as added", async () => {
    commitFile("tracked.txt", "one\n");
    commitFile("removed.txt", "bye\n");
    const mergeBase = rev("HEAD");
    write("tracked.txt", "one\ntwo\nthree\n");
    repo.git(["rm", "--quiet", "removed.txt"]);
    write("notes/untracked.txt", "a\nb\n");
    write("untracked.bin", Buffer.from([0, 1, 2, 0]));
    write("z-unread.txt", "never read\n");

    const diff = await readBranchDiff({
      cwd: repo.path,
      mergeBase,
      scope: "workingTree",
      limits: { ...defaultDiffLimits, maxUntrackedFiles: 2 },
    });

    expect(diff.files).toEqual([
      {
        path: "removed.txt",
        previousPath: null,
        status: "deleted",
        additions: 0,
        deletions: 1,
      },
      {
        path: "tracked.txt",
        previousPath: null,
        status: "modified",
        additions: 2,
        deletions: 0,
      },
      {
        path: "notes/untracked.txt",
        previousPath: null,
        status: "added",
        additions: 2,
        deletions: 0,
      },
      {
        path: "untracked.bin",
        previousPath: null,
        status: "added",
        additions: null,
        deletions: null,
      },
      {
        path: "z-unread.txt",
        previousPath: null,
        status: "added",
        additions: null,
        deletions: null,
      },
    ]);
    expect(diff.omitted).toEqual([
      { path: "untracked.bin", reason: "binary" },
      { path: "z-unread.txt", reason: "budget" },
    ]);
  });
});

describe("parseRawNumstat", () => {
  it("joins each numstat record to its raw status, a rename's both paths kept", () => {
    expect(
      parseRawNumstat(
        [
          ":000000 100644 0000000 1111111 A",
          ":odd.txt",
          ":100644 100644 2222222 2222222 R100",
          "old.txt",
          "new.txt",
          ":100644 120000 3333333 4444444 T",
          "link",
          "1\t0\t:odd.txt",
          "0\t0\t",
          "old.txt",
          "new.txt",
          "-\t-\tlink",
          "",
        ].join("\0"),
      ),
    ).toEqual([
      {
        path: ":odd.txt",
        paths: [":odd.txt"],
        lines: 1,
        stat: {
          path: ":odd.txt",
          previousPath: null,
          status: "added",
          additions: 1,
          deletions: 0,
        },
      },
      {
        path: "new.txt",
        paths: ["old.txt", "new.txt"],
        lines: 0,
        stat: {
          path: "new.txt",
          previousPath: "old.txt",
          status: "renamed",
          additions: 0,
          deletions: 0,
        },
      },
      {
        path: "link",
        paths: ["link"],
        lines: null,
        stat: {
          path: "link",
          previousPath: null,
          status: "modified",
          additions: null,
          deletions: null,
        },
      },
    ]);
  });
});

describe("parseNumstat", () => {
  it("reads both sides of a rename, and a binary file as null lines", () => {
    expect(
      parseNumstat(
        "1\t2\tplain.txt\0-\t-\timage.png\u00000\t0\t\0old.txt\0new.txt\0",
      ),
    ).toEqual([
      { path: "plain.txt", paths: ["plain.txt"], lines: 3 },
      { path: "image.png", paths: ["image.png"], lines: null },
      { path: "new.txt", paths: ["old.txt", "new.txt"], lines: 0 },
    ]);
  });
});
