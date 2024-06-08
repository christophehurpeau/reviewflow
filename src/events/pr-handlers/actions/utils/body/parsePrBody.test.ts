import { describe, expect, it } from "vitest";
import initialSimple from "./mocks/prBody-initial-simple";
import initialTable from "./mocks/prBody-initial-table";
import simple from "./mocks/prBody-simple";
import { parsePrBodyWithOptions } from "./parsePrBody";

describe("simple", () => {
  it("should parse default description", () => {
    const defaultOptions = {
      autoMerge: false,
      autoMergeWithSkipCi: false,
      deleteAfterMerge: true,
    };

    const parsed = parsePrBodyWithOptions(initialSimple, defaultOptions);

    expect(parsed).not.toBeFalsy();
    expect(parsed?.options).toEqual({
      autoMerge: false,
      autoMergeWithSkipCi: false,
      deleteAfterMerge: true,
    });
    expect(parsed?.commitNotes).toBe("");
  });

  it("should parse breaking changes", () => {
    const defaultOptions = {
      autoMerge: false,
      autoMergeWithSkipCi: false,
      deleteAfterMerge: true,
    };

    const parsed = parsePrBodyWithOptions(
      simple.replace(
        "### Options:",
        "### Commits Notes:\n\nSome commits Notes\n\n### Options:",
      ),
      defaultOptions,
    );

    expect(parsed).not.toBeFalsy();
    expect(parsed?.options).toEqual({
      autoMerge: false,
      autoMergeWithSkipCi: false,
      deleteAfterMerge: true,
    });
    expect(parsed?.commitNotes).toBe("Some commits Notes");
  });
});

describe("table", () => {
  it("should parse default description", () => {
    const defaultOptions = {
      autoMerge: false,
      autoMergeWithSkipCi: false,
      deleteAfterMerge: true,
    };

    const parsed = parsePrBodyWithOptions(initialTable, defaultOptions);

    expect(parsed).not.toBeFalsy();
    expect(parsed?.options).toEqual({
      autoMerge: false,
      autoMergeWithSkipCi: false,
      deleteAfterMerge: true,
    });
    expect(parsed?.commitNotes).toBe("");
  });
});

describe("table", () => {
  it("should parse edited description", () => {
    const defaultOptions = {
      autoMerge: false,
      autoMergeWithSkipCi: false,
      deleteAfterMerge: true,
    };

    const parsed = parsePrBodyWithOptions(simple, defaultOptions);

    expect(parsed).not.toBeFalsy();
    expect(parsed?.options).toEqual({
      autoMerge: false,
      autoMergeWithSkipCi: false,
      deleteAfterMerge: true,
    });
    expect(parsed?.commitNotes).toBe("");
  });
});
