import { StateEffect } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { ReactNode } from "react";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import type {
  EditorHighlight,
  EditorTextSelection,
  HighlightsValue,
} from "./highlights.ts";
import { highlightExtension, setHighlights } from "./highlights.ts";

/**
 * What a caller anchors to the text, shared by `MarkdownEditor` and
 * `CodeEditor`: marked passages, and the selection a new one is made from.
 */
export interface EditorAnnotationProps {
  /** passages to mark, such as the ones a comment is anchored to */
  highlights?: readonly EditorHighlight[];
  /** marked more strongly, and scrolled into view when it changes */
  activeHighlightId?: string | null;
  /** a click on a marked passage, with nothing selected */
  onHighlightPress?: (id: string) => void;
  /**
   * The passages after typing moved or deleted some, so the caller can keep
   * them: the editor maps them through its own changes, never through a new
   * `value`, which the caller lines its passages up with itself.
   */
  onHighlightsChange?: (highlights: EditorHighlight[]) => void;
  /** a non-empty selection in the text, or `null` once it is gone */
  onSelectionChange?: (selection: EditorTextSelection | null) => void;
  /**
   * Drawn just under the end of a selection once the pointer is released,
   * like the action bubble of a document editor: the place for a "Comment"
   * button. Pressing it keeps the selection.
   */
  renderSelectionAction?: (selection: EditorTextSelection) => ReactNode;
}

interface PlacedSelection {
  selection: EditorTextSelection;
  top: number;
  /** from the frame's left, or its right when the selection ends past its middle */
  left: number | null;
  right: number | null;
}

/**
 * The DOM's selection, not CodeMirror's: a read-only editor is not
 * contenteditable, and CodeMirror does not follow a selection it cannot focus.
 * A selection reaching outside the text is none.
 */
const readSelection = (view: EditorView): EditorTextSelection | null => {
  const selection = view.dom.ownerDocument.getSelection();
  if (
    selection === null ||
    selection.rangeCount === 0 ||
    selection.isCollapsed
  ) {
    return null;
  }
  const range = selection.getRangeAt(0);
  const content = view.contentDOM;
  if (
    !content.contains(range.startContainer) ||
    !content.contains(range.endContainer)
  ) {
    return null;
  }
  try {
    const start = view.posAtDOM(range.startContainer, range.startOffset);
    const end = view.posAtDOM(range.endContainer, range.endOffset);
    const from = Math.min(start, end);
    const to = Math.max(start, end);
    if (from === to) return null;
    return { from, to, text: view.state.sliceDoc(from, to) };
  } catch {
    return null;
  }
};

const place = (
  view: EditorView,
  frame: HTMLElement,
  selection: EditorTextSelection,
): PlacedSelection | null => {
  const end = view.coordsAtPos(selection.to, -1);
  if (end === null) return null;
  const box = frame.getBoundingClientRect();
  const left = end.left - box.left;
  const pastMiddle = left > box.width / 2;
  return {
    selection,
    top: end.bottom - box.top + 4,
    left: pastMiddle ? null : left,
    right: pastMiddle ? box.width - left : null,
  };
};

/**
 * The caller's passages, kept by content: a caller building the array on each
 * render must not rebuild the decorations on each render. The editor sets them
 * in the same transaction as a new `value`, since they are offsets in that
 * text: mapped through the diff, or set over the previous text, they would
 * mark the wrong words.
 */
export const useHighlightsValue = ({
  highlights,
  activeHighlightId = null,
}: EditorAnnotationProps): HighlightsValue => {
  const highlightsKey = JSON.stringify(highlights ?? []);
  const stableHighlights = useMemo(
    () => JSON.parse(highlightsKey) as EditorHighlight[],
    [highlightsKey],
  );
  return useMemo(
    () => ({ highlights: stableHighlights, activeId: activeHighlightId }),
    [stableHighlights, activeHighlightId],
  );
};

/**
 * Marks, selection and the selection's bubble on `view`, the editor's live
 * view (`null` until it is mounted, and again while it is remounted). It adds
 * its own CodeMirror extension to the view rather than asking the editor to
 * build it in, so every callback runs from an effect. Returns the bubble, to
 * render inside the editor's frame, which is its positioned ancestor.
 *
 * Called after the editor's effect syncing `value`, so `highlightsValue` is
 * set over the text it goes with.
 */
export function useEditorAnnotations(
  {
    onHighlightPress,
    onHighlightsChange,
    onSelectionChange,
    renderSelectionAction,
  }: EditorAnnotationProps,
  highlightsValue: HighlightsValue,
  view: EditorView | null,
): ReactNode {
  const [placed, setPlaced] = useState<PlacedSelection | null>(null);
  const emitPress = useEffectEvent((id: string) => onHighlightPress?.(id));
  const emitMoved = useEffectEvent((next: EditorHighlight[]) =>
    onHighlightsChange?.(next),
  );
  const emitSelection = useEffectEvent(
    (selection: EditorTextSelection | null) => onSelectionChange?.(selection),
  );
  const wantsSelection = useEffectEvent(
    () =>
      onSelectionChange !== undefined || renderSelectionAction !== undefined,
  );

  useEffect(() => {
    if (view === null) return undefined;
    view.dispatch({
      effects: StateEffect.appendConfig.of(
        highlightExtension({
          onPress: (id) => {
            emitPress(id);
          },
          onMoved: (next) => {
            emitMoved(next);
          },
        }),
      ),
    });

    const frame = view.dom.parentElement;
    const doc = view.dom.ownerDocument;
    let dragging = false;
    let last: EditorTextSelection | null = null;

    const update = (): void => {
      if (!wantsSelection()) return;
      const selection = dragging ? null : readSelection(view);
      const same = selection?.from === last?.from && selection?.to === last?.to;
      last = selection;
      if (!same) emitSelection(selection);
      setPlaced(
        selection === null || frame === null
          ? null
          : place(view, frame, selection),
      );
    };
    const reposition = (): void => {
      if (last !== null && frame !== null) setPlaced(place(view, frame, last));
    };
    const onPointerDown = (): void => {
      dragging = true;
      update();
    };
    const onPointerUp = (): void => {
      if (!dragging) return;
      dragging = false;
      // the selection settles after the pointer is released
      requestAnimationFrame(update);
    };

    doc.addEventListener("selectionchange", update);
    view.contentDOM.addEventListener("pointerdown", onPointerDown);
    doc.addEventListener("pointerup", onPointerUp);
    view.scrollDOM.addEventListener("scroll", reposition);
    const resize = new ResizeObserver(reposition);
    resize.observe(view.dom);

    return () => {
      doc.removeEventListener("selectionchange", update);
      view.contentDOM.removeEventListener("pointerdown", onPointerDown);
      doc.removeEventListener("pointerup", onPointerUp);
      view.scrollDOM.removeEventListener("scroll", reposition);
      resize.disconnect();
      setPlaced(null);
    };
  }, [view]);

  const shownActive = useRef<{ view: EditorView | null; id: string | null }>({
    view: null,
    id: null,
  });
  useEffect(() => {
    if (view === null) return;
    const { highlights, activeId } = highlightsValue;
    const effects: StateEffect<unknown>[] = [setHighlights.of(highlightsValue)];
    // scrolled to when it changes, not when a remounted view first shows it
    const shown = shownActive.current;
    if (shown.view === view && activeId !== shown.id) {
      const active = highlights.find(({ id }) => id === activeId);
      if (active !== undefined && active.to <= view.state.doc.length) {
        effects.push(EditorView.scrollIntoView(active.from, { y: "center" }));
      }
    }
    shownActive.current = { view, id: activeId };
    view.dispatch({ effects });
  }, [view, highlightsValue]);

  if (placed === null || renderSelectionAction === undefined) return null;
  return (
    <div
      role="presentation"
      className="markdown-editor-selection-action"
      style={{
        top: placed.top,
        left: placed.left ?? undefined,
        right: placed.right ?? undefined,
      }}
      // a press in the bubble must not collapse the selection it acts on
      onMouseDown={(event) => {
        event.preventDefault();
      }}
    >
      {renderSelectionAction(placed.selection)}
    </div>
  );
}
