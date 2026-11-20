import type { ReactNode } from "react";
import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { EditorInkScope } from "../editor/editorInkScope.tsx";
import type {
  EditorHighlight,
  EditorTextSelection,
} from "../editor/highlights.ts";
import "./text-highlights.css";

/**
 * Marks passages of content that is already rendered — markdown through
 * `MarkdownText`, a transcript — and reports the selection made in it, with
 * the same props as the editors' (`EditorAnnotationProps`), so a comment can
 * be anchored to what the reader sees rather than to the source.
 *
 * Offsets are in the rendered text: the concatenation of the content's text
 * nodes, which is what a DOM `Range` counts. They hold as long as the content
 * renders the same text, which is the caller's to keep (a document under
 * review does not change).
 *
 * Passages are drawn with the CSS Custom Highlight API (`CSS.highlights`,
 * `::highlight()`), which paints ranges without touching the DOM: React owns
 * the content's nodes, and a wrapping `<mark>` would be undone at its next
 * render. A browser without it shows no marks; the selection still works.
 *
 * **Web only**; `text-highlights.native.tsx` renders the content alone.
 */
export interface TextHighlightsProps {
  children: ReactNode;
  highlights?: readonly EditorHighlight[];
  activeHighlightId?: string | null;
  onHighlightPress?: (id: string) => void;
  onSelectionChange?: (selection: EditorTextSelection | null) => void;
  renderSelectionAction?: (selection: EditorTextSelection) => ReactNode;
}

const markName = "reviewflow-text-highlight";
const activeMarkName = "reviewflow-text-highlight-active";

/**
 * The page's two highlight registries are shared by every instance: each
 * keeps its own ranges here, and the registries are rebuilt from all of them.
 */
const rangesByInstance = new Map<string, { marks: Range[]; active: Range[] }>();

const publishMarks = (): void => {
  if (typeof CSS === "undefined" || !("highlights" in CSS)) return;
  const all = [...rangesByInstance.values()];
  CSS.highlights.set(markName, new Highlight(...all.flatMap((r) => r.marks)));
  CSS.highlights.set(
    activeMarkName,
    new Highlight(...all.flatMap((r) => r.active)),
  );
};

/** the action bubble is inside the container, but not part of its text */
const isContent = (node: Node, content: HTMLElement): boolean =>
  content.contains(node) &&
  (node.parentElement?.closest("[data-text-highlights-action]") ?? null) ===
    null;

const textNodesOf = (content: HTMLElement): Text[] => {
  const walker = content.ownerDocument.createTreeWalker(
    content,
    NodeFilter.SHOW_TEXT,
  );
  const nodes: Text[] = [];
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    if (isContent(node, content)) nodes.push(node as Text);
  }
  return nodes;
};

/** the offset in the rendered text of a DOM boundary point */
const offsetOf = (content: HTMLElement, node: Node, offset: number): number => {
  const before = content.ownerDocument.createRange();
  before.setStart(content, 0);
  before.setEnd(node, offset);
  return before.toString().length;
};

/** the DOM range over `from`..`to` of the rendered text, if it is that long */
const rangeOf = (
  content: HTMLElement,
  from: number,
  to: number,
): Range | null => {
  let seen = 0;
  let start: [Text, number] | null = null;
  for (const node of textNodesOf(content)) {
    const length = node.data.length;
    if (start === null && from < seen + length) start = [node, from - seen];
    if (start !== null && to <= seen + length) {
      const range = content.ownerDocument.createRange();
      range.setStart(...start);
      range.setEnd(node, to - seen);
      return range;
    }
    seen += length;
  }
  return null;
};

const readSelection = (content: HTMLElement): EditorTextSelection | null => {
  const selection = content.ownerDocument.getSelection();
  if (
    selection === null ||
    selection.rangeCount === 0 ||
    selection.isCollapsed
  ) {
    return null;
  }
  const range = selection.getRangeAt(0);
  if (
    !isContent(range.startContainer, content) ||
    !isContent(range.endContainer, content)
  ) {
    return null;
  }
  const from = offsetOf(content, range.startContainer, range.startOffset);
  const to = offsetOf(content, range.endContainer, range.endOffset);
  if (from >= to) return null;
  // the selection's own text keeps the line breaks between blocks
  return { from, to, text: selection.toString() };
};

/** the offset under a point, by whichever caret API the browser has */
const offsetAtPoint = (
  content: HTMLElement,
  x: number,
  y: number,
): number | null => {
  const doc = content.ownerDocument;
  if ("caretPositionFromPoint" in doc) {
    const position = doc.caretPositionFromPoint(x, y);
    if (position === null || !isContent(position.offsetNode, content)) {
      return null;
    }
    return offsetOf(content, position.offsetNode, position.offset);
  }
  const range = (
    doc as Document & {
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
    }
  ).caretRangeFromPoint?.(x, y);
  if (range === null || range === undefined) return null;
  if (!isContent(range.startContainer, content)) return null;
  return offsetOf(content, range.startContainer, range.startOffset);
};

interface PlacedSelection {
  selection: EditorTextSelection;
  top: number;
  left: number | null;
  right: number | null;
}

const place = (
  content: HTMLElement,
  selection: EditorTextSelection,
): PlacedSelection | null => {
  const range = rangeOf(content, selection.from, selection.to);
  const rects = range === null ? [] : [...range.getClientRects()];
  const end = rects.at(-1);
  if (end === undefined) return null;
  const box = content.getBoundingClientRect();
  const left = end.right - box.left;
  const pastMiddle = left > box.width / 2;
  return {
    selection,
    top: end.bottom - box.top + 4,
    left: pastMiddle ? null : left,
    right: pastMiddle ? box.width - left : null,
  };
};

export function TextHighlights({
  children,
  highlights,
  activeHighlightId = null,
  onHighlightPress,
  onSelectionChange,
  renderSelectionAction,
}: TextHighlightsProps): ReactNode {
  const instance = useId();
  const contentRef = useRef<HTMLDivElement>(null);
  const [placed, setPlaced] = useState<PlacedSelection | null>(null);
  const emitSelection = useEffectEvent(
    (selection: EditorTextSelection | null) => onSelectionChange?.(selection),
  );
  const wantsSelection = useEffectEvent(
    () =>
      onSelectionChange !== undefined || renderSelectionAction !== undefined,
  );
  const readHighlights = useEffectEvent(() => ({
    highlights: highlights ?? [],
    activeId: activeHighlightId,
  }));
  const emitPress = useEffectEvent((id: string) => onHighlightPress?.(id));

  // by content: a caller building the array on each render must not rebuild
  // the ranges on each render
  const highlightsKey = JSON.stringify(highlights ?? []);

  // the ranges, rebuilt when the passages change and when the content's DOM
  // does: React may replace the text nodes a range points into
  useEffect(() => {
    const content = contentRef.current;
    if (content === null) return undefined;
    const build = (): void => {
      const value = readHighlights();
      const marks: Range[] = [];
      const active: Range[] = [];
      for (const { id, from, to } of value.highlights) {
        if (from >= to) continue;
        const range = rangeOf(content, from, to);
        if (range === null) continue;
        (id === value.activeId ? active : marks).push(range);
      }
      rangesByInstance.set(instance, { marks, active });
      publishMarks();
    };
    build();
    let frame: number | null = null;
    const observer = new MutationObserver(() => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        build();
      });
    });
    observer.observe(content, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => {
      observer.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
      rangesByInstance.delete(instance);
      publishMarks();
    };
  }, [instance, highlightsKey, activeHighlightId]);

  // the active passage is brought into view when it changes, not at mount
  const shownActive = useRef(activeHighlightId);
  useEffect(() => {
    const content = contentRef.current;
    if (content === null || activeHighlightId === shownActive.current) return;
    shownActive.current = activeHighlightId;
    const active = readHighlights().highlights.find(
      ({ id }) => id === activeHighlightId,
    );
    if (active === undefined) return;
    rangeOf(
      content,
      active.from,
      active.to,
    )?.startContainer.parentElement?.scrollIntoView({
      block: "center",
      behavior: "smooth",
    });
  }, [activeHighlightId]);

  useEffect(() => {
    const content = contentRef.current;
    if (content === null) return undefined;
    const doc = content.ownerDocument;
    let dragging = false;
    let last: EditorTextSelection | null = null;

    const update = (): void => {
      if (!wantsSelection()) return;
      const selection = dragging ? null : readSelection(content);
      const same = selection?.from === last?.from && selection?.to === last?.to;
      last = selection;
      if (!same) emitSelection(selection);
      setPlaced(selection === null ? null : place(content, selection));
    };
    const reposition = (): void => {
      if (last !== null) setPlaced(place(content, last));
    };
    const onPointerDown = (event: PointerEvent): void => {
      if (!isContent(event.target as Node, content)) return;
      dragging = true;
      update();
    };
    const onPointerUp = (): void => {
      if (!dragging) return;
      dragging = false;
      // the selection settles after the pointer is released
      requestAnimationFrame(update);
    };
    const onClick = (event: MouseEvent): void => {
      const selection = doc.getSelection();
      if (selection !== null && !selection.isCollapsed) return;
      const offset = offsetAtPoint(content, event.clientX, event.clientY);
      if (offset === null) return;
      let pressed: EditorHighlight | null = null;
      for (const highlight of readHighlights().highlights) {
        const over = highlight.from <= offset && offset < highlight.to;
        const shorter =
          pressed === null ||
          highlight.to - highlight.from < pressed.to - pressed.from;
        if (over && shorter) pressed = highlight;
      }
      if (pressed !== null) emitPress(pressed.id);
    };

    doc.addEventListener("selectionchange", update);
    content.addEventListener("pointerdown", onPointerDown);
    doc.addEventListener("pointerup", onPointerUp);
    content.addEventListener("click", onClick);
    const resize = new ResizeObserver(reposition);
    resize.observe(content);
    return () => {
      doc.removeEventListener("selectionchange", update);
      content.removeEventListener("pointerdown", onPointerDown);
      doc.removeEventListener("pointerup", onPointerUp);
      content.removeEventListener("click", onClick);
      resize.disconnect();
      setPlaced(null);
    };
  }, []);

  return (
    <EditorInkScope>
      <div ref={contentRef} className="text-highlights">
        {children}
        {placed === null || renderSelectionAction === undefined ? null : (
          <div
            data-text-highlights-action
            role="presentation"
            className="text-highlights-action"
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
        )}
      </div>
    </EditorInkScope>
  );
}
