import { describe, expect, it } from "vitest";
import { inlineFormatChange } from "./inlineFormat.ts";

describe("inlineFormatChange", () => {
  it("wraps a selection in the format's markers", () => {
    expect(
      inlineFormatChange({
        text: "a word here",
        from: 2,
        to: 6,
        format: "bold",
      }),
    ).toEqual({ insert: "**word**", from: 2, to: 6, selection: 10 });
  });

  it("removes markers sitting just outside the selection", () => {
    expect(
      inlineFormatChange({
        text: "a **word** here",
        from: 4,
        to: 8,
        format: "bold",
      }),
    ).toEqual({ insert: "word", from: 2, to: 10, selection: 6 });
  });

  it("removes markers the selection itself includes", () => {
    expect(
      inlineFormatChange({
        text: "a `code` here",
        from: 2,
        to: 8,
        format: "code",
      }),
    ).toEqual({ insert: "code", from: 2, to: 8, selection: 6 });
  });

  it("wraps a selection as a link, and unwraps a whole link back to its label", () => {
    expect(
      inlineFormatChange({ text: "see docs", from: 4, to: 8, format: "link" }),
    ).toEqual({ insert: "[docs](url)", from: 4, to: 8, selection: 15 });
    expect(
      inlineFormatChange({
        text: "see [docs](https://x.dev)",
        from: 4,
        to: 25,
        format: "link",
      }),
    ).toEqual({ insert: "docs", from: 4, to: 25, selection: 8 });
  });

  it("adds italic inside bold rather than removing the bold", () => {
    const text = "a **bold** b";
    expect(
      inlineFormatChange({ text, from: 4, to: 8, format: "italic" }),
    ).toEqual({ insert: "*bold*", from: 4, to: 8, selection: 10 });
    expect(
      inlineFormatChange({ text, from: 2, to: 10, format: "italic" }),
    ).toEqual({ insert: "***bold***", from: 2, to: 10, selection: 12 });
  });

  it("removes only the format asked from bold italic text", () => {
    const text = "a ***both*** b";
    expect(
      inlineFormatChange({ text, from: 5, to: 9, format: "italic" }),
    ).toEqual({ insert: "both", from: 4, to: 10, selection: 8 });
    expect(
      inlineFormatChange({ text, from: 5, to: 9, format: "bold" }),
    ).toEqual({ insert: "both", from: 3, to: 11, selection: 7 });
  });

  it("wraps text inside a double-backtick span rather than opening it", () => {
    expect(
      inlineFormatChange({ text: "``code``", from: 2, to: 6, format: "code" }),
    ).toEqual({ insert: "`code`", from: 2, to: 6, selection: 8 });
  });

  it("does nothing on an empty selection", () => {
    expect(
      inlineFormatChange({ text: "text", from: 1, to: 1, format: "italic" }),
    ).toBeNull();
  });
});
