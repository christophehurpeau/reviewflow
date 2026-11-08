import { syntaxTree } from "@codemirror/language";
import type {
  EditorState,
  SelectionRange,
  StateCommand,
} from "@codemirror/state";
import { EditorSelection } from "@codemirror/state";
import type { KeyBinding } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import type { InlineFormat, InlineFormatChange } from "./inlineFormat.ts";
import { inlineFormatChange } from "./inlineFormat.ts";
import type { LineType } from "./lineTypes.ts";
import { applyLinePrefix, stripLinePrefix } from "./lineTypes.ts";

/**
 * The toolbar's and the shortcuts' commands: the pure transforms of
 * `inlineFormat.ts` and `lineTypes.ts` applied to every selection range. Ported
 * from vscode-extension-markdown-beautiful-editor (`src/webview/cm/commands/`).
 */
const formatOfNode: Readonly<Record<string, InlineFormat>> = {
  StrongEmphasis: "bold",
  Emphasis: "italic",
  InlineCode: "code",
  Strikethrough: "strikethrough",
  Link: "link",
};

/**
 * The construct of `format` enclosing `position`, delimiters included: with no
 * selection, a toggle acts on the whole `**bold**` the cursor is in.
 */
export const enclosingFormatRange = (
  state: EditorState,
  position: number,
  format: InlineFormat,
): { from: number; to: number } | null => {
  for (
    let node: SyntaxNode | null = syntaxTree(state).resolveInner(position, -1);
    node;
    node = node.parent
  ) {
    if (formatOfNode[node.name] === format) {
      return { from: node.from, to: node.to };
    }
  }
  return null;
};

/**
 * After a wrap the selected text sits verbatim inside the insert, so the same
 * text stays selected; after an unwrap the whole insert is what remains.
 */
const selectionOverSameText = (
  lineFrom: number,
  selected: string,
  change: InlineFormatChange,
): SelectionRange => {
  const insertFrom = lineFrom + change.from;
  const index =
    change.insert.length > selected.length
      ? change.insert.indexOf(selected)
      : -1;
  return index === -1
    ? EditorSelection.range(insertFrom, insertFrom + change.insert.length)
    : EditorSelection.range(
        insertFrom + index,
        insertFrom + index + selected.length,
      );
};

interface RangeToggle {
  changes: { from: number; to: number; insert: string };
  range: SelectionRange;
}

const rangeToggle = (
  state: EditorState,
  range: SelectionRange,
  format: InlineFormat,
): RangeToggle | null => {
  const target = range.empty
    ? enclosingFormatRange(state, range.head, format)
    : { from: range.from, to: range.to };
  if (target === null) return null;

  const line = state.doc.lineAt(target.from);
  if (state.doc.lineAt(target.to).number !== line.number) return null;

  const change = inlineFormatChange({
    text: line.text,
    from: target.from - line.from,
    to: target.to - line.from,
    format,
  });
  if (change === null) return null;

  return {
    changes: {
      from: line.from + change.from,
      to: line.from + change.to,
      insert: change.insert,
    },
    range: range.empty
      ? EditorSelection.cursor(line.from + change.selection)
      : selectionOverSameText(
          line.from,
          state.doc.sliceString(target.from, target.to),
          change,
        ),
  };
};

const overlaps = (
  a: { from: number; to: number },
  b: { from: number; to: number },
): boolean => a.from < b.to && b.from < a.to;

export const toggleInlineFormat =
  (format: InlineFormat): StateCommand =>
  ({ state, dispatch }) => {
    // two cursors in one construct resolve to the same range and would each
    // rewrite it, doubling the markers: the first one wins
    const applied: { from: number; to: number }[] = [];
    const transaction = state.changeByRange((range) => {
      const toggle = rangeToggle(state, range, format);
      if (
        toggle === null ||
        applied.some((span) => overlaps(span, toggle.changes))
      ) {
        return { range };
      }
      applied.push(toggle.changes);
      return toggle;
    });

    if (applied.length === 0) return false;
    dispatch(state.update(transaction, { scrollIntoView: true }));
    return true;
  };

/** the line each cursor's head is on, rewritten once even under two cursors */
export const setLineType =
  (type: LineType): StateCommand =>
  ({ state, dispatch }) => {
    const rewritten = new Set<number>();
    const transaction = state.changeByRange((range) => {
      const line = state.doc.lineAt(range.head);
      if (rewritten.has(line.from)) {
        return { range: EditorSelection.cursor(line.from) };
      }
      const insert = applyLinePrefix(stripLinePrefix(line.text), type);
      if (insert === line.text) return { range };
      rewritten.add(line.from);
      return {
        changes: { from: line.from, to: line.to, insert },
        range: EditorSelection.cursor(line.from),
      };
    });

    if (rewritten.size === 0) return false;
    dispatch(state.update(transaction, { scrollIntoView: true }));
    return true;
  };

/**
 * Mod-i is `selectParentSyntax` in the default keymap, so this keymap is
 * installed above it (see `extensions.ts`).
 */
export const formattingKeymap: KeyBinding[] = [
  { key: "Mod-b", run: toggleInlineFormat("bold") },
  { key: "Mod-i", run: toggleInlineFormat("italic") },
  { key: "Mod-e", run: toggleInlineFormat("code") },
  { key: "Mod-k", run: toggleInlineFormat("link") },
  { key: "Mod-Shift-x", run: toggleInlineFormat("strikethrough") },
];
