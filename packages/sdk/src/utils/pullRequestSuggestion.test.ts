import { describe, expect, it } from "vitest";
import type { SuggestionCommitFacts } from "./pullRequestSuggestion.ts";
import {
  parseSuggestions,
  suggestionCommitRefusal,
  suggestionOriginalLines,
  suggestionRangesOverlap,
} from "./pullRequestSuggestion.ts";

describe("parseSuggestions", () => {
  it("reads each suggestion block, CRLF bodies included", () => {
    expect(
      parseSuggestions(
        "Better:\r\n```suggestion\r\nconst a = 1;\r\n  return a;\r\n```\r\nand\n```suggestion\n```",
      ),
    ).toEqual([["const a = 1;", "  return a;"], []]);
  });

  it("ignores other fences and a suggestion quoted inside one", () => {
    expect(
      parseSuggestions(
        "```ts\nx\n```\n````md\n```suggestion\ny\n```\n````\n~~~ suggestion\nz\n~~~",
      ),
    ).toEqual([["z"]]);
  });

  it("strips the fence's indentation and runs an open fence to the end", () => {
    expect(parseSuggestions("  ```suggestion\n    a\n b")).toEqual([
      ["  a", "b"],
    ]);
  });

  it("is not fooled by inline code", () => {
    expect(parseSuggestions("use ```suggestion` here")).toEqual([]);
  });
});

const thread = {
  diffHunk: "@@ -1,4 +1,4 @@\n a\n-b\n+B\n c",
  side: "RIGHT",
  line: 3,
  startLine: 2,
  originalLine: 3,
  originalStartLine: 2,
} as const;

describe("suggestionOriginalLines", () => {
  it("reads the range's lines of its side from the end of the hunk", () => {
    expect(suggestionOriginalLines(thread)).toEqual(["B", "c"]);
    expect(
      suggestionOriginalLines({
        ...thread,
        diffHunk: "@@ -1,2 +1,1 @@\n a\n-b",
        side: "LEFT",
        startLine: null,
      }),
    ).toEqual(["b"]);
  });

  it("measures an outdated thread by its original range", () => {
    expect(
      suggestionOriginalLines({ ...thread, line: null, startLine: null }),
    ).toEqual(["B", "c"]);
  });

  it("is null when the hunk is shorter than the range", () => {
    expect(suggestionOriginalLines({ ...thread, startLine: 1, line: 9 })).toBe(
      null,
    );
  });
});

const committable: SuggestionCommitFacts = {
  state: "open",
  viewerCanApplySuggestion: true,
  suggestionCount: 1,
  outdated: false,
  line: 3,
  side: "RIGHT",
  startSide: null,
};

describe("suggestionCommitRefusal", () => {
  it("accepts one suggestion on current lines of the head", () => {
    expect(suggestionCommitRefusal(committable)).toBe(null);
    expect(suggestionCommitRefusal({ ...committable, state: "draft" })).toBe(
      null,
    );
  });

  it("says why a suggestion cannot be committed", () => {
    expect(
      suggestionCommitRefusal({ ...committable, state: "merged" }),
    ).toMatch(/is merged/);
    expect(
      suggestionCommitRefusal({
        ...committable,
        viewerCanApplySuggestion: false,
      }),
    ).toMatch(/does not let you/);
    expect(
      suggestionCommitRefusal({ ...committable, suggestionCount: 2 }),
    ).toMatch(/more than one/);
    expect(suggestionCommitRefusal({ ...committable, outdated: true })).toMatch(
      /Outdated/,
    );
    expect(
      suggestionCommitRefusal({ ...committable, startSide: "LEFT" }),
    ).toMatch(/removed lines/);
  });
});

describe("suggestionRangesOverlap", () => {
  it("compares ranges of one file only", () => {
    const a = { path: "a.ts", startLine: 2, line: 4 };
    expect(
      suggestionRangesOverlap(a, { path: "a.ts", startLine: null, line: 4 }),
    ).toBe(true);
    expect(
      suggestionRangesOverlap(a, { path: "a.ts", startLine: 5, line: 6 }),
    ).toBe(false);
    expect(
      suggestionRangesOverlap(a, { path: "b.ts", startLine: 2, line: 4 }),
    ).toBe(false);
  });
});
