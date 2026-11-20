import type { EditorState, Extension, Range } from "@codemirror/state";
import { StateEffect, StateField } from "@codemirror/state";
import type { DecorationSet } from "@codemirror/view";
import { Decoration, EditorView } from "@codemirror/view";

/**
 * Passages of the text marked by the caller — what a comment is anchored to —
 * as mark decorations, so the text itself is never touched. The caller owns
 * them: it sets them whole (`setHighlights`), and the editor only maps them
 * through the document's changes until it sets them again, so a passage
 * follows the text typed around it and one whose text is deleted is gone.
 */
export interface EditorHighlight {
  id: string;
  /** offsets in the document, `from` < `to` */
  from: number;
  to: number;
}

/** A non-empty selection in the document, with the text it covers. */
export interface EditorTextSelection {
  from: number;
  to: number;
  text: string;
}

interface HighlightsValue {
  highlights: readonly EditorHighlight[];
  activeId: string | null;
}

export const setHighlights = StateEffect.define<HighlightsValue>();

interface HighlightSpec {
  highlightId: string;
}

/**
 * Empty or out-of-range passages are dropped rather than clamped: an offset
 * past the end means the caller's text and the editor's differ, and a mark
 * on the wrong words would say something false.
 */
export const buildHighlightDecorations = (
  state: EditorState,
  { highlights, activeId }: HighlightsValue,
): DecorationSet => {
  const length = state.doc.length;
  const ranges: Range<Decoration>[] = highlights
    .filter(
      ({ from, to }) =>
        Number.isInteger(from) &&
        Number.isInteger(to) &&
        from >= 0 &&
        from < to &&
        to <= length,
    )
    .map(({ id, from, to }) =>
      Decoration.mark({
        class:
          id === activeId ? "cm-highlight cm-highlight-active" : "cm-highlight",
        attributes: { "data-highlight-id": id },
        highlightId: id,
      }).range(from, to),
    );
  return Decoration.set(ranges, true);
};

export const highlightField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(set, transaction) {
    let next = set.map(transaction.changes);
    for (const effect of transaction.effects) {
      if (effect.is(setHighlights)) {
        next = buildHighlightDecorations(transaction.state, effect.value);
      }
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

const idOf = (decoration: Decoration): string =>
  (decoration.spec as HighlightSpec).highlightId;

/** The passages as they stand now, in document order. */
export const highlightsOf = (state: EditorState): EditorHighlight[] => {
  const found: EditorHighlight[] = [];
  state
    .field(highlightField, false)
    ?.between(0, state.doc.length, (from, to, decoration) => {
      found.push({ id: idOf(decoration), from, to });
    });
  return found;
};

/** The innermost passage over `pos`: the shortest, when they overlap. */
export const highlightAt = (
  state: EditorState,
  pos: number,
): EditorHighlight | null => {
  let best: EditorHighlight | null = null;
  const set = state.field(highlightField, false);
  if (set === undefined) return null;
  const cursor = set.iter(pos);
  while (cursor.value !== null && cursor.from <= pos) {
    const { from, to, value } = cursor;
    if (to >= pos && (best === null || to - from < best.to - best.from)) {
      best = { id: idOf(value), from, to };
    }
    cursor.next();
  }
  return best;
};

interface HighlightExtensionOptions {
  onPress: (id: string) => void;
  /** after a change to the document moved or dropped a passage */
  onMoved: (highlights: EditorHighlight[]) => void;
}

/**
 * The field, a click on a passage, and the report of passages a change moved.
 * A click that ends a drag is a selection, not a press: it is reported only
 * when nothing is selected.
 */
export const highlightExtension = ({
  onPress,
  onMoved,
}: HighlightExtensionOptions): Extension => [
  highlightField,
  EditorView.domEventHandlers({
    click(event, view) {
      const selection = view.dom.ownerDocument.getSelection();
      if (selection !== null && !selection.isCollapsed) return false;
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos === null) return false;
      const highlight = highlightAt(view.state, pos);
      if (highlight === null) return false;
      onPress(highlight.id);
      return false;
    },
  }),
  EditorView.updateListener.of((update) => {
    if (!update.docChanged) return;
    const before = update.startState.field(highlightField, false);
    if (before === undefined || before.size === 0) return;
    const moved = update.transactions.every(
      (transaction) =>
        !transaction.effects.some((effect) => effect.is(setHighlights)),
    );
    if (moved) onMoved(highlightsOf(update.state));
  }),
];
