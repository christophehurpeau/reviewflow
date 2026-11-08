import { describe, expect, it } from "vitest";
import { columnWeights } from "./table-columns.ts";

describe("columnWeights", () => {
  it("weighs each column by its longest cell, header included", () => {
    expect(
      columnWeights([
        ["Package", "Type", "Update", "Change"],
        ["actions/setup-node", "action", "major", "v6 → v7"],
      ]),
    ).toEqual([18, 6, 6, 7]);
  });

  it("caps a column of prose and floors an empty one", () => {
    expect(columnWeights([["a".repeat(200), ""]])).toEqual([40, 3]);
  });

  it("measures the longest line of a multiline cell", () => {
    expect(columnWeights([["short\na much longer line"]])).toEqual([18]);
  });

  it("covers the columns of a ragged row", () => {
    expect(columnWeights([["a"], ["bbbb", "cccccc"]])).toEqual([4, 6]);
  });
});
