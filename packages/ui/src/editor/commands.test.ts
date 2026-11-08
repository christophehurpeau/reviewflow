import { describe, expect, it } from "vitest";
import { ensureSyntaxTree } from "@codemirror/language";
import type { StateCommand, Transaction } from "@codemirror/state";
import { EditorSelection, EditorState } from "@codemirror/state";
import { setLineType, toggleInlineFormat } from "./commands.ts";
import { changeBetween, markdownLanguage } from "./extensions.ts";

const run = (
  doc: string,
  selection: EditorSelection,
  command: StateCommand,
): { doc: string; selected: string } | null => {
  const state = EditorState.create({
    doc,
    selection,
    extensions: [
      markdownLanguage(),
      EditorState.allowMultipleSelections.of(true),
    ],
  });
  ensureSyntaxTree(state, state.doc.length, 5000);
  let transaction: Transaction | null = null;
  const ran = command({
    state,
    dispatch: (next) => {
      transaction = next;
    },
  });
  if (!ran || transaction === null) return null;
  const next = (transaction as Transaction).state;
  const { from, to } = next.selection.main;
  return { doc: next.doc.toString(), selected: next.doc.sliceString(from, to) };
};

describe("toggleInlineFormat", () => {
  it("wraps the selection and keeps the same text selected", () => {
    expect(
      run(
        "a word",
        EditorSelection.create([EditorSelection.range(2, 6)]),
        toggleInlineFormat("bold"),
      ),
    ).toEqual({ doc: "a **word**", selected: "word" });
  });

  it("unwraps the construct a collapsed cursor is in", () => {
    expect(
      run(
        "a **word** b",
        EditorSelection.create([EditorSelection.cursor(5)]),
        toggleInlineFormat("bold"),
      ),
    ).toEqual({ doc: "a word b", selected: "" });
  });

  it("does nothing for a collapsed cursor outside any construct", () => {
    expect(
      run(
        "plain",
        EditorSelection.create([EditorSelection.cursor(2)]),
        toggleInlineFormat("italic"),
      ),
    ).toBeNull();
  });
});

describe("setLineType", () => {
  it("rewrites the cursor's line, whatever its current type", () => {
    expect(
      run(
        "- item\nnext",
        EditorSelection.create([EditorSelection.cursor(3)]),
        setLineType("h1"),
      ),
    ).toEqual({ doc: "# item\nnext", selected: "" });
  });

  it("does nothing when the line already is that type", () => {
    expect(
      run(
        "> quote",
        EditorSelection.create([EditorSelection.cursor(1)]),
        setLineType("quote"),
      ),
    ).toBeNull();
  });
});

describe("changeBetween", () => {
  it("is the span between the common prefix and suffix", () => {
    expect(changeBetween("hello world", "hello brave world")).toEqual({
      from: 6,
      to: 6,
      insert: "brave ",
    });
    expect(changeBetween("aXb", "ab")).toEqual({ from: 1, to: 2, insert: "" });
  });

  it("is null when nothing changed", () => {
    expect(changeBetween("same", "same")).toBeNull();
  });

  it("does not let the prefix and suffix overlap on a repeated character", () => {
    expect(changeBetween("aa", "aaa")).toEqual({ from: 2, to: 2, insert: "a" });
  });
});
