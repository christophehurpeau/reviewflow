import type { EditorState } from "@codemirror/state";
import type { SyntaxNodeRef } from "@lezer/common";

/**
 * GitHub alerts (`> [!NOTE]` … `> [!CAUTION]`) are ordinary blockquotes to
 * CommonMark, so they are read off a `Blockquote` node's first line rather than
 * parsed by a block parser of their own, which would have to reimplement
 * blockquote continuation and nesting. Ported from
 * vscode-extension-markdown-beautiful-editor (`src/shared/alerts.ts`,
 * `src/webview/cm/decorations/alerts.ts`).
 */
export type AlertType = "caution" | "important" | "note" | "tip" | "warning";

const alertHeaderPattern =
  /^>\s*\[!(?<type>NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/iu;

export const parseAlertHeader = (line: string): AlertType | null => {
  const type = alertHeaderPattern.exec(line)?.groups?.type;
  return type === undefined ? null : (type.toLowerCase() as AlertType);
};

/**
 * The classes for one line of an alert block. The header and the last line
 * carry boundary classes, so the corners are rounded without a wrapper
 * element: a line decoration has none to give.
 */
const alertLineClasses = (
  type: AlertType,
  index: number,
  total: number,
): string[] => {
  const isLast = index === total - 1;
  const classes =
    index === 0
      ? ["md-alert", `md-alert-${type}`, "alert-first"]
      : ["md-alert-content", `md-alert-${type}`];
  if (isLast) classes.push("alert-last");
  if (isLast && index === 0) classes.push("alert-single");
  return classes;
};

export interface AlertLine {
  /** the line's start position */
  from: number;
  classes: string[];
}

export const alertLinesOfBlockquote = (
  state: EditorState,
  blockquote: SyntaxNodeRef,
): AlertLine[] => {
  const firstLine = state.doc.lineAt(blockquote.from);
  const type = parseAlertHeader(firstLine.text);
  if (type === null) return [];

  const lastLine = state.doc.lineAt(
    Math.max(blockquote.from, blockquote.to - 1),
  );
  const total = lastLine.number - firstLine.number + 1;

  return Array.from({ length: total }, (_, index) => ({
    from: state.doc.line(firstLine.number + index).from,
    classes: alertLineClasses(type, index, total),
  }));
};

export interface AlertHeaderMark {
  from: number;
  to: number;
  className: "md-alert-type" | "md-syntax";
}

/**
 * The `NOTE` label and its `[!` / `]` delimiters, in document positions. The
 * leading `>` is a `QuoteMark` and is muted by the node map already.
 */
export const alertHeaderMarks = (
  state: EditorState,
  blockquote: SyntaxNodeRef,
): AlertHeaderMark[] => {
  const line = state.doc.lineAt(blockquote.from);
  if (parseAlertHeader(line.text) === null) return [];

  const open = line.text.indexOf("[!");
  const close = line.text.indexOf("]", open);
  if (open === -1 || close === -1) return [];

  return [
    {
      from: line.from + open,
      to: line.from + open + 2,
      className: "md-syntax",
    },
    {
      from: line.from + open + 2,
      to: line.from + close,
      className: "md-alert-type",
    },
    {
      from: line.from + close,
      to: line.from + close + 1,
      className: "md-syntax",
    },
  ];
};
