import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import type { EditorHighlight } from "./highlights.ts";
import {
  highlightAt,
  highlightField,
  highlightsOf,
  setHighlights,
} from "./highlights.ts";

/**
 * Asserted over a plain `EditorState`, like the markdown decorations: which
 * characters carry which class, and where a passage stands after a change.
 */
const doc = "The plan adds a hello file, then checks it.";

const withHighlights = (
  highlights: readonly EditorHighlight[],
  activeId: string | null = null,
): EditorState =>
  EditorState.create({ doc, extensions: [highlightField] }).update({
    effects: setHighlights.of({ highlights, activeId }),
  }).state;

const marks = (state: EditorState): { text: string; class: string }[] => {
  const found: { text: string; class: string }[] = [];
  state
    .field(highlightField)
    .between(0, state.doc.length, (from, to, value) => {
      found.push({
        text: state.sliceDoc(from, to),
        class: String(value.spec.class),
      });
    });
  return found;
};

const hello = { id: "a", from: 16, to: 26 };

describe("highlights", () => {
  it("marks each passage, the active one more strongly", () => {
    const state = withHighlights([hello, { id: "b", from: 33, to: 42 }], "b");
    expect(marks(state)).toEqual([
      { text: "hello file", class: "cm-highlight" },
      { text: "checks it", class: "cm-highlight cm-highlight-active" },
    ]);
  });

  it("drops empty, reversed and out-of-range passages", () => {
    const state = withHighlights([
      { id: "empty", from: 3, to: 3 },
      { id: "reversed", from: 10, to: 4 },
      { id: "past", from: 40, to: 400 },
      hello,
    ]);
    expect(highlightsOf(state)).toEqual([hello]);
  });

  it("replaces the passages whole when set again", () => {
    const state = withHighlights([hello]).update({
      effects: setHighlights.of({
        highlights: [{ id: "b", from: 0, to: 3 }],
        activeId: null,
      }),
    }).state;
    expect(highlightsOf(state)).toEqual([{ id: "b", from: 0, to: 3 }]);
  });

  it("sets passages over the new text when they come with it", () => {
    const state = withHighlights([hello]).update({
      changes: { from: doc.length, insert: " Then ships." },
      effects: setHighlights.of({
        highlights: [{ id: "c", from: 49, to: 54 }],
        activeId: null,
      }),
    }).state;
    expect(marks(state)).toEqual([{ text: "ships", class: "cm-highlight" }]);
  });

  it("follows the text typed before, inside and after a passage", () => {
    const state = withHighlights([hello]);
    const before = state.update({ changes: { from: 0, insert: "So: " } }).state;
    expect(highlightsOf(before)).toEqual([{ id: "a", from: 20, to: 30 }]);

    const inside = state.update({
      changes: { from: 22, insert: "world " },
    }).state;
    expect(marks(inside)).toEqual([
      { text: "hello world file", class: "cm-highlight" },
    ]);

    const after = state.update({ changes: { from: 30, insert: "!" } }).state;
    expect(highlightsOf(after)).toEqual([hello]);
  });

  it("drops a passage whose text is deleted", () => {
    const state = withHighlights([hello]).update({
      changes: { from: 14, to: 27 },
    }).state;
    expect(highlightsOf(state)).toEqual([]);
  });

  it("finds the innermost passage over a position", () => {
    const state = withHighlights([{ id: "outer", from: 10, to: 40 }, hello]);
    expect(highlightAt(state, 20)?.id).toBe("a");
    expect(highlightAt(state, 12)?.id).toBe("outer");
    expect(highlightAt(state, 2)).toBeNull();
  });
});
