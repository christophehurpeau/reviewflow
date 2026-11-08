import { describe, expect, it } from "vitest";
import {
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
