import { describe, expect, it } from "vitest";
import { diffLines } from "./lineDiff.ts";

/** `-a +b   c`, which is what the transcript renders and what reads in a test. */
const marked = (before: string, after: string): string[] =>
  diffLines({ before, after }).map(
    (line) =>
      `${{ added: "+", context: " ", removed: "-" }[line.kind]}${line.text}`,
  );

describe("diffLines", () => {
  it("marks two identical sides as context throughout", () => {
    expect(marked("one\ntwo", "one\ntwo")).toEqual([" one", " two"]);
  });

  it("reads an insertion as the added lines alone", () => {
    expect(marked("one\nfour", "one\ntwo\nthree\nfour")).toEqual([
      " one",
      "+two",
      "+three",
      " four",
    ]);
  });

  it("reads a deletion as the removed lines alone", () => {
    expect(marked("one\ntwo\nthree", "one\nthree")).toEqual([
      " one",
      "-two",
      " three",
    ]);
  });

  /**
   * The trim is what makes an edit small: a fragment is chosen to be unique, so
   * it opens and closes on lines its replacement keeps.
   */
  it("keeps a replacement inside the context it shares", () => {
    expect(marked("head\nbody\ntail", "head\nbetter body\ntail")).toEqual([
      " head",
      "-body",
      "+better body",
      " tail",
    ]);
  });

  /** Git's order, and what lets the two lines be read as one replacement. */
  it("emits a removal before the addition that replaces it", () => {
    expect(marked("a", "b")).toEqual(["-a", "+b"]);
  });

  it("reads a whole new file as every line added", () => {
    expect(marked("", "one\ntwo")).toEqual(["+one", "+two"]);
  });

  it("reads an emptied file as every line removed", () => {
    expect(marked("one\ntwo", "")).toEqual(["-one", "-two"]);
  });

  /** A file that ends in a newline is not a file with a blank last line. */
  it("drops one trailing newline and no more", () => {
    expect(marked("", "one\n")).toEqual(["+one"]);
    expect(marked("", "one\n\n")).toEqual(["+one", "+"]);
  });

  it("reads two empty sides as nothing at all", () => {
    expect(diffLines({ before: "", after: "" })).toEqual([]);
  });

  /**
   * Past the cell cap the table is not built and the sides come back whole —
   * a correct diff, only not a minimal one.
   */
  it("emits both sides whole rather than sizing a pathological table", () => {
    const before = Array.from({ length: 500 }, (_, at) => `a${String(at)}`);
    const after = Array.from({ length: 500 }, (_, at) => `b${String(at)}`);

    const lines = diffLines({
      before: before.join("\n"),
      after: after.join("\n"),
    });

    expect(lines.filter((line) => line.kind === "removed")).toHaveLength(500);
    expect(lines.filter((line) => line.kind === "added")).toHaveLength(500);
    expect(lines[0]).toEqual({ kind: "removed", text: "a0" });
    expect(lines[500]).toEqual({ kind: "added", text: "b0" });
  });

  /** The trim runs first, so a large edit with shared ends still diffs. */
  it("diffs a large pair that shares its ends", () => {
    const shared = Array.from({ length: 400 }, (_, at) => `line ${String(at)}`);
    const before = [...shared, "old", ...shared].join("\n");
    const after = [...shared, "new", ...shared].join("\n");

    const lines = diffLines({ before, after });

    expect(lines).toHaveLength(802);
    expect(lines[400]).toEqual({ kind: "removed", text: "old" });
    expect(lines[401]).toEqual({ kind: "added", text: "new" });
  });
});
