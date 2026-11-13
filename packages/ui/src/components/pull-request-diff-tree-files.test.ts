import { describe, expect, it } from "vitest";
import {
  changedFilesOf,
  diffTreeFilesOf,
  fileStatusesOf,
} from "./pull-request-diff-tree-files.ts";

const patch = [
  "diff --git a/src/changed.ts b/src/changed.ts",
  "index 1111111..2222222 100644",
  "--- a/src/changed.ts",
  "+++ b/src/changed.ts",
  "@@ -1 +1 @@",
  "-a",
  "+b",
  "diff --git a/src/new file.ts b/src/new file.ts",
  "new file mode 100644",
  "index 0000000..3333333",
  "--- /dev/null",
  "+++ b/src/new file.ts",
  "@@ -0,0 +1 @@",
  "+c",
  "diff --git a/src/gone.ts b/src/gone.ts",
  "deleted file mode 100644",
  "index 4444444..0000000",
  "--- a/src/gone.ts",
  "+++ /dev/null",
  "@@ -1 +0,0 @@",
  "-d",
  "diff --git a/src/old.ts b/src/moved.ts",
  "similarity index 90%",
  "rename from src/old.ts",
  "rename to src/moved.ts",
  "",
].join("\n");

describe("fileStatusesOf", () => {
  it("reads each file's status from its git header", () => {
    expect([...fileStatusesOf(patch)]).toEqual([
      ["src/changed.ts", "modified"],
      ["src/new file.ts", "added"],
      ["src/gone.ts", "deleted"],
      ["src/moved.ts", "renamed"],
    ]);
  });

  it("is empty for an empty patch", () => {
    expect(fileStatusesOf("").size).toBe(0);
  });
});

describe("diffTreeFilesOf", () => {
  it("lists the patch files with their status, then the omitted ones", () => {
    expect(
      diffTreeFilesOf({
        patch,
        groups: [
          {
            name: "",
            paths: [
              "src/changed.ts",
              "src/new file.ts",
              "src/gone.ts",
              "src/moved.ts",
              "src/unreadable.ts",
            ],
          },
        ],
        omitted: [{ path: "assets/logo.png", reason: "binary" }],
      }),
    ).toEqual([
      { path: "src/changed.ts", status: "modified" },
      { path: "src/new file.ts", status: "added" },
      { path: "src/gone.ts", status: "deleted" },
      { path: "src/moved.ts", status: "renamed" },
      { path: "src/unreadable.ts", status: "modified" },
      { path: "assets/logo.png", status: null },
    ]);
  });
});

describe("changedFilesOf", () => {
  const groups = [{ name: "", paths: ["src/changed.ts", "src/moved.ts"] }];

  it("takes the git stats when the diff carries them, with why a file is left out", () => {
    expect(
      changedFilesOf({
        patch,
        groups,
        omitted: [{ path: "assets/logo.png", reason: "binary" }],
        files: [
          {
            path: "src/changed.ts",
            previousPath: null,
            status: "modified",
            additions: 2,
            deletions: 1,
          },
          {
            path: "src/moved.ts",
            previousPath: "src/old.ts",
            status: "renamed",
            additions: 0,
            deletions: 0,
          },
          {
            path: "assets/logo.png",
            previousPath: null,
            status: "added",
            additions: null,
            deletions: null,
          },
        ],
      }),
    ).toEqual([
      {
        path: "src/changed.ts",
        status: "modified",
        additions: 2,
        deletions: 1,
      },
      { path: "src/moved.ts", status: "renamed", additions: 0, deletions: 0 },
      {
        path: "assets/logo.png",
        status: "added",
        omitted: "binary",
        additions: null,
        deletions: null,
      },
    ]);
  });

  it("reads the patch's headers when the diff has no stats", () => {
    const diff = {
      patch,
      groups,
      omitted: [{ path: "assets/logo.png", reason: "binary" as const }],
    };

    expect(changedFilesOf(diff)).toEqual(diffTreeFilesOf(diff));
  });
});
