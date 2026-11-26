import { describe, expect, it } from "vitest";
import type { DiffWalkthroughDraft } from "./walkthrough.ts";
import {
  annotatePatch,
  completeWalkthrough,
  patchOfHunks,
  patchOfPaths,
  patchOutsideHunks,
  readStoredWalkthrough,
  splitPatch,
  stepHunks,
} from "./walkthrough.ts";

const patch = [
  "diff --git a/src/app.ts b/src/app.ts",
  "index 1111111..2222222 100644",
  "--- a/src/app.ts",
  "+++ b/src/app.ts",
  "@@ -1,3 +1,3 @@",
  " a",
  "-b",
  "+B",
  " c",
  "@@ -20,2 +20,3 @@ function x() {",
  " y",
  "+z",
  " w",
  "diff --git a/old.ts b/renamed.ts",
  "similarity index 100%",
  "rename from old.ts",
  "rename to renamed.ts",
  "diff --git a/src/new.ts b/src/new.ts",
  "new file mode 100644",
  "index 0000000..3333333",
  "--- /dev/null",
  "+++ b/src/new.ts",
  "@@ -0,0 +1 @@",
  "+export const n = 1;",
  "\\ No newline at end of file",
  "",
].join("\n");

const statement = { text: "Why", sources: [{ label: "ticket", url: null }] };

const draft = (hunks: string[][]): DiffWalkthroughDraft => ({
  title: "A change",
  ticket: null,
  problem: statement,
  weaknesses: [],
  chapters: [
    {
      id: "c1",
      title: "Chapter",
      summary: "What the chapter does",
      steps: hunks.map((ids, index) => ({
        id: `s${String(index)}`,
        title: "Step",
        explanation: "Explained",
        hunks: ids,
        notes: [],
        concerns: [],
      })),
    },
  ],
});

const complete = (candidate: unknown): ReturnType<typeof completeWalkthrough> =>
  completeWalkthrough({
    candidate,
    patch,
    head: "h".repeat(40),
    base: "b".repeat(40),
    writtenAt: "2026-11-26T00:00:00.000Z",
  });

describe("splitPatch", () => {
  it("names each hunk by its file and rank, with its lines on both sides", () => {
    const files = splitPatch(patch);
    expect(files.map(({ path }) => path)).toEqual([
      "src/app.ts",
      "renamed.ts",
      "src/new.ts",
    ]);
    expect(
      files[0]?.hunks.map(({ id, oldStart, oldLines, newStart, newLines }) => [
        id,
        oldStart,
        oldLines,
        newStart,
        newLines,
      ]),
    ).toEqual([
      ["src/app.ts#1", 1, 3, 1, 3],
      ["src/app.ts#2", 20, 2, 20, 3],
    ]);
    expect(files[1]?.hunks).toEqual([]);
    expect(files[2]?.hunks[0]).toMatchObject({
      id: "src/new.ts#1",
      oldStart: 0,
      oldLines: 0,
      newStart: 1,
      newLines: 1,
    });
  });

  it("keeps the no-newline marker in its hunk", () => {
    expect(splitPatch(patch)[2]?.hunks[0]?.text).toContain(
      "\\ No newline at end of file",
    );
  });

  it("joins back into the same patch when nothing is filtered", () => {
    expect(patchOutsideHunks(patch, [])).toBe(patch);
  });
});

describe("patchOfPaths", () => {
  it("keeps the named files whole, a pure rename included", () => {
    expect(patchOfPaths(patch, ["renamed.ts", "src/new.ts"])).toBe(
      [
        "diff --git a/old.ts b/renamed.ts",
        "similarity index 100%",
        "rename from old.ts",
        "rename to renamed.ts",
        "diff --git a/src/new.ts b/src/new.ts",
        "new file mode 100644",
        "index 0000000..3333333",
        "--- /dev/null",
        "+++ b/src/new.ts",
        "@@ -0,0 +1 @@",
        "+export const n = 1;",
        "\\ No newline at end of file",
        "",
      ].join("\n"),
    );
  });

  it("is empty when no file is named", () => {
    expect(patchOfPaths(patch, ["missing.ts"])).toBe("");
  });
});

describe("patchOfHunks", () => {
  it("keeps only the hunks overlapping the ranges, with their file header", () => {
    const only = patchOfHunks(patch, [
      {
        path: "src/app.ts",
        oldStart: 20,
        oldLines: 2,
        newStart: 20,
        newLines: 3,
      },
    ]);
    expect(only).toBe(
      [
        "diff --git a/src/app.ts b/src/app.ts",
        "index 1111111..2222222 100644",
        "--- a/src/app.ts",
        "+++ b/src/app.ts",
        "@@ -20,2 +20,3 @@ function x() {",
        " y",
        "+z",
        " w",
        "",
      ].join("\n"),
    );
  });

  it("matches a hunk read with whitespace hidden by its lines, not its rank", () => {
    const hidden = [
      "diff --git a/src/app.ts b/src/app.ts",
      "--- a/src/app.ts",
      "+++ b/src/app.ts",
      "@@ -21 +21,2 @@",
      " y",
      "+z",
      "",
    ].join("\n");
    expect(
      patchOfHunks(hidden, [
        {
          path: "src/app.ts",
          oldStart: 20,
          oldLines: 2,
          newStart: 20,
          newLines: 3,
        },
      ]),
    ).toBe(hidden);
  });
});

describe("patchOutsideHunks", () => {
  it("keeps what no range overlaps, files without hunks included", () => {
    const rest = patchOutsideHunks(patch, [
      {
        path: "src/app.ts",
        oldStart: 1,
        oldLines: 3,
        newStart: 1,
        newLines: 3,
      },
      {
        path: "src/new.ts",
        oldStart: 0,
        oldLines: 0,
        newStart: 1,
        newLines: 1,
      },
    ]);
    expect(
      splitPatch(rest).map(({ path, hunks }) => [path, hunks.length]),
    ).toEqual([
      ["src/app.ts", 1],
      ["renamed.ts", 0],
    ]);
  });
});

describe("annotatePatch", () => {
  it("puts each hunk's id before it", () => {
    const annotated = annotatePatch(patch);
    expect(annotated).toContain("### hunk src/app.ts#2\n@@ -20,2 +20,3 @@");
    expect(annotated).toContain("### hunk src/new.ts#1\n@@ -0,0 +1 @@");
  });
});

describe("completeWalkthrough", () => {
  it("resolves the cited hunks to their lines", () => {
    const { walkthrough, errors } = complete(draft([["src/app.ts#2"]]));
    expect(errors).toBeNull();
    expect(walkthrough?.hunks).toEqual({
      "src/app.ts#2": {
        path: "src/app.ts",
        oldStart: 20,
        oldLines: 2,
        newStart: 20,
        newLines: 3,
      },
    });
    expect(
      walkthrough === null
        ? []
        : stepHunks(walkthrough, walkthrough.chapters[0]!.steps[0]!),
    ).toHaveLength(1);
  });

  it("lists every error: an unknown hunk, a hunk placed twice, an unknown key", () => {
    const candidate = {
      ...draft([["src/app.ts#9", "src/app.ts#1"], ["src/app.ts#1"]]),
      explaination: "typo",
    };
    expect(complete(candidate).errors).toEqual([
      "walkthrough.explaination: unknown key",
      "walkthrough.chapters[0].steps[0].hunks[0]: src/app.ts#9 is no hunk of the diff",
      "walkthrough.chapters[0].steps[1].hunks[0]: src/app.ts#1 is already in walkthrough.chapters[0].steps[0]",
    ]);
  });

  it("refuses a statement without a source and a note on another step's hunk", () => {
    const base = draft([["src/app.ts#1"]]);
    const candidate = {
      ...base,
      problem: { text: "Why", sources: [] },
      chapters: [
        {
          ...base.chapters[0]!,
          steps: [
            {
              ...base.chapters[0]!.steps[0]!,
              notes: [{ hunk: "src/app.ts#2", text: "elsewhere" }],
            },
          ],
        },
      ],
    };
    expect(complete(candidate).errors).toEqual([
      "walkthrough.problem.sources: at least one item is expected",
      "walkthrough.chapters[0].steps[0].notes[0].hunk: not one of the step's hunks",
    ]);
  });

  it("refuses a weak point naming no step of the walkthrough", () => {
    const candidate = {
      ...draft([["src/app.ts#1"]]),
      weaknesses: [
        {
          text: "An empty answer reads as a failed read",
          decision: "Accepted: the next pass asks again",
          sources: [{ label: "Finding 1", url: null }],
          steps: ["s0", "s9"],
        },
      ],
    };
    expect(complete(candidate).errors).toEqual([
      "walkthrough.weaknesses[0].steps[1]: s9 is no step id",
    ]);
  });

  it("keeps a weak point no source records a decision on", () => {
    const candidate = {
      ...draft([["src/app.ts#1"]]),
      weaknesses: [
        {
          text: "The state file only grows",
          decision: null,
          sources: [{ label: "the diff", url: null }],
          steps: [],
        },
      ],
    };
    expect(complete(candidate).walkthrough?.weaknesses[0]?.decision).toBeNull();
  });

  it("refuses duplicated step ids", () => {
    const base = draft([["src/app.ts#1"], ["src/app.ts#2"]]);
    const candidate = {
      ...base,
      chapters: [
        {
          ...base.chapters[0]!,
          steps: base.chapters[0]!.steps.map((step) => ({
            ...step,
            id: "same",
          })),
        },
      ],
    };
    expect(complete(candidate).errors).toEqual(["step id same is used twice"]);
  });
});

describe("readStoredWalkthrough", () => {
  it("reads the first format without its decisions and questions", () => {
    const stored = readStoredWalkthrough({
      version: 1,
      title: "A change",
      decisions: [statement],
      questions: ["Why?"],
      chapters: [{ id: "c", title: "Chapter", steps: [] }],
    });
    expect(stored).toEqual({
      version: 2,
      title: "A change",
      weaknesses: [],
      chapters: [{ id: "c", title: "Chapter", summary: "", steps: [] }],
    });
  });

  it("refuses an unknown format", () => {
    expect(readStoredWalkthrough({ version: 3 })).toBeNull();
  });
});
