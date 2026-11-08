import { describe, expect, it } from "vitest";
import { applyLinePrefix, stripLinePrefix } from "./lineTypes.ts";

describe("stripLinePrefix", () => {
  it("leaves the bare content of any line type", () => {
    expect(stripLinePrefix("## Title")).toBe("Title");
    expect(stripLinePrefix("- [x] done")).toBe("done");
    expect(stripLinePrefix("- item")).toBe("item");
    expect(stripLinePrefix("12. item")).toBe("item");
    expect(stripLinePrefix(">> quoted")).toBe("quoted");
    expect(stripLinePrefix("plain")).toBe("plain");
  });
});

describe("applyLinePrefix", () => {
  it("turns bare content into the requested line type", () => {
    expect(applyLinePrefix("Title", "h2")).toBe("## Title");
    expect(applyLinePrefix("todo", "task")).toBe("- [ ] todo");
    expect(applyLinePrefix("x", "code")).toBe("```\nx\n```");
    expect(applyLinePrefix("text", "paragraph")).toBe("text");
  });

  it("converts one line type to another through the bare content", () => {
    expect(applyLinePrefix(stripLinePrefix("- item"), "ol")).toBe("1. item");
  });
});
