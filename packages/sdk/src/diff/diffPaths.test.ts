import { describe, expect, it } from "vitest";
import { diffPaths } from "./diffPaths.ts";

const githubPatch = [
  "diff --git a/src/app.ts b/src/app.ts",
  "--- a/src/app.ts",
  "+++ b/src/app.ts",
  "@@ -1 +1 @@",
  "-old",
  "+new",
  "",
].join("\n");

describe("diffPaths", () => {
  it("names each file after the change, whatever its kind", () => {
    const patch = [
      githubPatch,
      "diff --git a/docs/old guide.md b/docs/old guide.md",
      "deleted file mode 100644",
      "--- a/docs/old guide.md",
      "+++ /dev/null",
      "diff --git a/assets/logo.png b/assets/logo.png",
      "Binary files /dev/null and b/assets/logo.png differ",
      "diff --git a/lib/a.ts b/lib/b.ts",
      "similarity index 100%",
      "rename from lib/a.ts",
      "rename to lib/b.ts",
      "",
    ].join("\n");

    expect(diffPaths(patch)).toEqual([
      "src/app.ts",
      "docs/old guide.md",
      "assets/logo.png",
      "lib/b.ts",
    ]);
    expect(diffPaths("")).toEqual([]);
  });

  it("drops the tab git ends a spaced name with", () => {
    const patch = [
      "diff --git a/with space.txt b/with space.txt",
      "--- a/with space.txt\t",
      "+++ b/with space.txt\t",
      "@@ -1 +1,2 @@",
      "",
    ].join("\n");

    expect(diffPaths(patch)).toEqual(["with space.txt"]);
  });

  it("unquotes the names git quotes C-style", () => {
    const patch = [
      'diff --git "a/caf\\303\\251.txt" "b/caf\\303\\251.txt"',
      '--- "a/caf\\303\\251.txt"',
      '+++ "b/caf\\303\\251.txt"',
      "@@ -1 +1,2 @@",
      'diff --git "a/tab\\there.png" "b/tab\\there.png"',
      'Binary files /dev/null and "b/tab\\there.png" differ',
      'diff --git "a/old\\"q.ts" "b/new\\"q.ts"',
      "similarity index 100%",
      'rename from "old\\"q.ts"',
      'rename to "new\\"q.ts"',
      "",
    ].join("\n");

    expect(diffPaths(patch)).toEqual(["café.txt", "tab\there.png", 'new"q.ts']);
  });
});
