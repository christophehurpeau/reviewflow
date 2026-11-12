import { describe, expect, it } from "vitest";
import { parsePatchFiles } from "@pierre/diffs";
import { diffPaths } from "@reviewflow/sdk";
import { fileOfPath } from "./diff-file-of-path.ts";

/**
 * Written by git 2.x (`git diff -M --src-prefix=a/ --dst-prefix=b/`, as
 * `readBranchDiff` runs it): names starting with `a/` and `b/`, one holding
 * ` b/`, quoted and tab-ended ones, renames with and without edits, a binary,
 * a new and a deleted file.
 */
const patch = [
  "diff --git a/a/b/y.ts b/a/b/y.ts",
  "new file mode 100644",
  "index 0000000..975fbec",
  "--- /dev/null",
  "+++ b/a/b/y.ts",
  "@@ -0,0 +1 @@",
  "+y",
  "diff --git a/a/old.ts b/b/old.ts",
  "similarity index 100%",
  "rename from a/old.ts",
  "rename to b/old.ts",
  "diff --git a/b/x.ts b/b/x.ts",
  "index 587be6b..b77b4eb 100644",
  "--- a/b/x.ts",
  "+++ b/b/x.ts",
  "@@ -1 +1,2 @@",
  " x",
  "+y",
  "diff --git a/dir b/z.ts b/dir b/z.ts",
  "new file mode 100644",
  "index 0000000..b680253",
  "--- /dev/null",
  "+++ b/dir b/z.ts\t",
  "@@ -0,0 +1 @@",
  "+z",
  "diff --git a/moved.ts b/dir/moved.ts",
  "similarity index 90%",
  "rename from moved.ts",
  "rename to dir/moved.ts",
  "index ccbf85e..9b32c26 100644",
  "--- a/moved.ts",
  "+++ b/dir/moved.ts",
  "@@ -8,3 +8,4 @@ same",
  " same",
  " same",
  " same",
  "+more",
  "diff --git a/edited.ts b/edited.ts",
  "index 422c2b7..0f7bc76 100644",
  "--- a/edited.ts",
  "+++ b/edited.ts",
  "@@ -1,2 +1,2 @@",
  " a",
  "-b",
  "+c",
  "diff --git a/gone.ts b/gone.ts",
  "deleted file mode 100644",
  "index 286c5f5..0000000",
  "--- a/gone.ts",
  "+++ /dev/null",
  "@@ -1 +0,0 @@",
  "-gone",
  "diff --git a/logo.png b/logo.png",
  "index d5d0b8b..4a27031 100644",
  "Binary files a/logo.png and b/logo.png differ",
  "diff --git a/pure.ts b/pure2.ts",
  "similarity index 100%",
  "rename from pure.ts",
  "rename to pure2.ts",
  'diff --git "a/say \\"hi\\".ts" "b/say \\"hi\\".ts"',
  "new file mode 100644",
  "index 0000000..bca70f3",
  "--- /dev/null",
  '+++ "b/say \\"hi\\".ts"\t',
  "@@ -0,0 +1 @@",
  "+q",
  "diff --git a/é.ts b/é.ts",
  "new file mode 100644",
  "index 0000000..8ba3a16",
  "--- /dev/null",
  "+++ b/é.ts",
  "@@ -0,0 +1 @@",
  "+n",
  "",
].join("\n");

const files = parsePatchFiles(patch).flatMap((parsed) => parsed.files);

describe("fileOfPath", () => {
  it("finds every file by the path the sdk names it with", () => {
    const paths = diffPaths(patch);

    expect(paths).toHaveLength(11);
    expect(paths.map((path) => fileOfPath(files, path)?.name)).toEqual(paths);
  });

  it("tells each kind of change apart", () => {
    const typeOf = (path: string): string | undefined =>
      fileOfPath(files, path)?.type;

    expect(typeOf("a/b/y.ts")).toBe("new");
    expect(typeOf("gone.ts")).toBe("deleted");
    expect(typeOf("edited.ts")).toBe("change");
    expect(typeOf("logo.png")).toBe("change");
    expect(typeOf("pure2.ts")).toBe("rename-pure");
    expect(typeOf("dir/moved.ts")).toBe("rename-changed");
    expect(typeOf("b/old.ts")).toBe("rename-pure");
    expect(typeOf("dir b/z.ts")).toBe("new");
    expect(typeOf('say "hi".ts')).toBe("new");
    expect(typeOf("é.ts")).toBe("new");
  });

  it("names nothing by the path a file had before its rename, nor a path not in the patch", () => {
    expect(fileOfPath(files, "a/old.ts")).toBeUndefined();
    expect(fileOfPath(files, "moved.ts")).toBeUndefined();
    expect(fileOfPath(files, "pure.ts")).toBeUndefined();
    expect(fileOfPath(files, "missing.ts")).toBeUndefined();
    expect(fileOfPath([], "edited.ts")).toBeUndefined();
  });
});
