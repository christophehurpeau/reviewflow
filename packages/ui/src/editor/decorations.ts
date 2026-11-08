import { syntaxTree } from "@codemirror/language";
import type { EditorState, Range } from "@codemirror/state";
import { Prec } from "@codemirror/state";
import type { DecorationSet, ViewUpdate } from "@codemirror/view";
import { Decoration, EditorView, ViewPlugin } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { alertHeaderMarks, alertLinesOfBlockquote } from "./alerts.ts";
import { nodeClassEntry } from "./nodeClasses.ts";

/**
 * The markdown look: a walk of the syntax tree over the visible ranges that
 * turns nodes into three decoration sets — lines, construct marks and
 * delimiter marks (see `nodeClasses.ts` for why three). **Only marks and line
 * classes, never a replace or a widget**: the markdown stays visible and is
 * edited as the text it is, so what is saved is byte for byte what was typed
 * and a file under git takes no diff it did not ask for.
 *
 * Ported from vscode-extension-markdown-beautiful-editor
 * (`src/webview/cm/decorations.ts`), whose header documents each special case.
 */
export interface MarkdownDecorationSets {
  lines: DecorationSet;
  marks: DecorationSet;
  syntax: DecorationSet;
}

type TableColumnAlign = "center" | "left" | "none" | "right";

const alignOfDelimiterCell = (cell: string): TableColumnAlign => {
  const trimmed = cell.trim();
  const left = trimmed.startsWith(":");
  const right = trimmed.endsWith(":");
  if (left && right) return "center";
  if (right) return "right";
  if (left) return "left";
  return "none";
};

/** `|:--|:-:|` → one alignment per column; the edge pipes leave empty cells */
const tableColumnAligns = (delimiterRow: string): TableColumnAlign[] =>
  delimiterRow.split("|").slice(1, -1).map(alignOfDelimiterCell);

const blockquoteDepth = (node: SyntaxNode): number => {
  let depth = 0;
  for (
    let current: SyntaxNode | null = node;
    current;
    current = current.parent
  ) {
    if (current.name === "Blockquote") depth += 1;
  }
  return depth;
};

/**
 * `Decoration.mark().range()` throws on an empty range, and a throw here takes
 * the whole plugin down: CodeMirror deactivates it and every class in the
 * document disappears. `![](x)` reaches here empty from ordinary text.
 */
const pushMark = (
  target: Range<Decoration>[],
  className: string,
  from: number,
  to: number,
): void => {
  if (to > from) {
    target.push(Decoration.mark({ class: className }).range(from, to));
  }
};

const isSetextHeading = (name: string): boolean =>
  name === "SetextHeading1" || name === "SetextHeading2";

const isCheckedTask = (state: EditorState, task: SyntaxNode): boolean => {
  const marker = task.getChild("TaskMarker");
  return (
    marker !== null && /x/iu.test(state.doc.sliceString(marker.from, marker.to))
  );
};

/** the nearest enclosing task decides: an unchecked sub-task stops a checked parent */
const isInsideCheckedTask = (state: EditorState, node: SyntaxNode): boolean => {
  for (let current = node.parent; current; current = current.parent) {
    const task = current.name === "ListItem" ? current.getChild("Task") : null;
    if (task !== null) return isCheckedTask(state, task);
  }
  return false;
};

export const buildMarkdownDecorations = (
  state: EditorState,
  ranges: readonly { from: number; to: number }[],
): MarkdownDecorationSets => {
  const marks: Range<Decoration>[] = [];
  const syntax: Range<Decoration>[] = [];
  // keyed by line start, so a line touched by several nodes gets one decoration
  const lineClasses = new Map<number, Set<string>>();

  const addLineClasses = (
    from: number,
    to: number,
    className: string,
  ): void => {
    let position = from;
    while (position <= to) {
      const line = state.doc.lineAt(position);
      const classes = lineClasses.get(line.from) ?? new Set<string>();
      classes.add(className);
      lineClasses.set(line.from, classes);
      position = line.to + 1;
    }
  };
  const addLineClassAt = (position: number, className: string): void => {
    addLineClasses(position, position, className);
  };

  const lastLineOf = (node: { from: number; to: number }): number =>
    state.doc.lineAt(Math.max(node.from, node.to - 1)).from;

  const addBlockBoundaries = (node: SyntaxNode, prefix: string): void => {
    addLineClassAt(state.doc.lineAt(node.from).from, `${prefix}-first`);
    addLineClassAt(lastLineOf(node), `${prefix}-last`);
  };

  const handleBlockquote = (node: SyntaxNode): void => {
    const depth = Math.min(blockquoteDepth(node), 3);
    addLineClasses(node.from, node.to, `md-quote-${String(depth)}`);
    if (depth === 1) addBlockBoundaries(node, "blockquote");
    for (const line of alertLinesOfBlockquote(state, node)) {
      for (const className of line.classes) {
        addLineClassAt(line.from, className);
      }
    }
    for (const mark of alertHeaderMarks(state, node)) {
      pushMark(
        mark.className === "md-syntax" ? syntax : marks,
        mark.className,
        mark.from,
        mark.to,
      );
    }
  };

  const handleSetextHeading = (node: SyntaxNode): void => {
    const underline = lastLineOf(node);
    addLineClasses(
      node.from,
      Math.max(node.from, underline - 1),
      "md-setext-title",
    );
    addLineClassAt(underline, "md-setext-underline");
  };

  /**
   * `text-decoration` cannot be undone on a child, so it goes on the text
   * between the `~~` rather than on the construct.
   */
  const handleStrikethrough = (node: SyntaxNode): void => {
    const [open, close] = node.getChildren("StrikethroughMark");
    if (open !== undefined && close !== undefined) {
      pushMark(marks, "md-strike-text", open.to, close.from);
    }
  };

  const handleLink = (node: SyntaxNode): void => {
    const [open, close] = node.getChildren("LinkMark");
    if (open !== undefined && close !== undefined) {
      pushMark(marks, "md-text", open.to, close.from);
    }
    if (node.getChild("LinkLabel") !== null) {
      pushMark(marks, "md-ref-link", node.from, node.to);
    }
  };

  const handleImage = (node: SyntaxNode): void => {
    const [open, close] = node.getChildren("LinkMark");
    if (open !== undefined && close !== undefined) {
      pushMark(syntax, "md-alt", open.to, close.from);
    }
  };

  /** unlike other bracketed nodes, a `LinkLabel`'s range includes its brackets */
  const handleLinkLabel = (node: SyntaxNode): void => {
    pushMark(syntax, "md-syntax", node.from, node.from + 1);
    pushMark(syntax, "md-syntax", node.to - 1, node.to);
    pushMark(marks, "md-ref", node.from + 1, node.to - 1);
  };

  const handleLinkTitle = (node: SyntaxNode): void => {
    pushMark(
      marks,
      node.parent?.name === "LinkReference"
        ? "md-link-def-title"
        : "md-link-title",
      node.from,
      node.to,
    );
  };

  const handleTask = (node: SyntaxNode): void => {
    pushMark(
      marks,
      isCheckedTask(state, node)
        ? "md-task md-task-checked"
        : "md-task md-task-unchecked",
      node.from,
      node.to,
    );
  };

  /** a checked task's `Task` node stops at its first paragraph; its children are still done */
  const handleParagraph = (node: SyntaxNode): void => {
    if (isInsideCheckedTask(state, node)) {
      pushMark(marks, "md-task-parent-checked", node.from, node.to);
    }
  };

  /**
   * `TableDelimiter` is a lone `|` inside a row, but the whole `|:--|` row when
   * it is the table's own child — one node name, two jobs. The alignment is
   * not a node at all and is read back off that row's text. The walk still
   * descends: a cell's content is inline markdown.
   */
  const handleTable = (node: SyntaxNode): void => {
    const delimiterRow = node.getChild("TableDelimiter");
    const aligns =
      delimiterRow === null
        ? []
        : tableColumnAligns(
            state.doc.sliceString(delimiterRow.from, delimiterRow.to),
          );

    const emitRowCells = (row: SyntaxNode): void => {
      let column = 0;
      for (let child = row.firstChild; child; child = child.nextSibling) {
        if (child.name === "TableDelimiter") {
          pushMark(syntax, "md-syntax", child.from, child.to);
        } else if (child.name === "TableCell") {
          const align = aligns[column] ?? "none";
          pushMark(
            marks,
            `md-table-cell md-col-${align}`,
            child.from,
            child.to,
          );
          column += 1;
        }
      }
    };

    for (let row = node.firstChild; row; row = row.nextSibling) {
      if (row.name === "TableHeader" || row.name === "TableRow") {
        emitRowCells(row);
      }
    }

    if (delimiterRow === null) return;
    const text = state.doc.sliceString(delimiterRow.from, delimiterRow.to);
    let cellStart = -1;
    let column = 0;
    for (let index = 0; index < text.length; index += 1) {
      if (text[index] !== "|") continue;
      const at = delimiterRow.from + index;
      pushMark(syntax, "md-syntax", at, at + 1);
      if (cellStart >= 0) {
        const align = aligns[column] ?? "none";
        pushMark(
          marks,
          `md-table-cell md-table-sep md-col-${align}`,
          delimiterRow.from + cellStart,
          at,
        );
        column += 1;
      }
      cellStart = index + 1;
    }
  };

  const tree = syntaxTree(state);
  for (const { from, to } of ranges) {
    tree.iterate({
      from,
      to,
      enter(ref) {
        // another language's tokens — a fence's code, the yaml mounted over
        // frontmatter — are never markdown constructs
        if (ref.name === "CodeText" || ref.name === "FrontmatterContent") {
          return false;
        }

        const entry = nodeClassEntry(ref.name);
        if (entry?.layer === "mark") {
          pushMark(marks, entry.className, ref.from, ref.to);
        }
        if (entry?.layer === "syntax") {
          pushMark(syntax, entry.className, ref.from, ref.to);
        }
        if (entry?.layer === "line") {
          const lineTo = isSetextHeading(ref.name)
            ? lastLineOf(ref) - 1
            : ref.to;
          addLineClasses(ref.from, Math.max(ref.from, lineTo), entry.className);
        }

        const node = ref.node;
        switch (ref.name) {
          case "Blockquote":
            handleBlockquote(node);
            break;
          case "FencedCode":
            addBlockBoundaries(node, "md-code-block");
            break;
          case "Frontmatter":
            addBlockBoundaries(node, "md-frontmatter");
            break;
          case "SetextHeading1":
          case "SetextHeading2":
            handleSetextHeading(node);
            break;
          case "HorizontalRule":
            pushMark(marks, "md-hr-text", ref.from, ref.to);
            break;
          case "Escape":
            pushMark(syntax, "md-syntax", ref.from, ref.from + 1);
            break;
          case "Strikethrough":
            handleStrikethrough(node);
            break;
          case "Link":
            handleLink(node);
            break;
          case "Image":
            handleImage(node);
            break;
          case "LinkLabel":
            handleLinkLabel(node);
            break;
          case "LinkTitle":
            handleLinkTitle(node);
            break;
          case "Task":
            handleTask(node);
            break;
          case "Paragraph":
            handleParagraph(node);
            break;
          case "Table":
            handleTable(node);
            break;
          default:
            break;
        }
        return undefined;
      },
    });
  }

  const lines = [...lineClasses.entries()].map(([from, classes]) =>
    Decoration.line({ class: [...classes].join(" ") }).range(from),
  );

  return {
    lines: Decoration.set(lines, true),
    marks: Decoration.set(marks, true),
    syntax: Decoration.set(syntax, true),
  };
};

const emptySets: MarkdownDecorationSets = {
  lines: Decoration.none,
  marks: Decoration.none,
  syntax: Decoration.none,
};

/**
 * A throw from a plugin's `update` deactivates it for the rest of the session,
 * so a failed build keeps the previous sets — or none when the document
 * changed, since ranges built against the old one can point past its end.
 */
const buildOrKeep = (
  state: EditorState,
  ranges: readonly { from: number; to: number }[],
  previous: MarkdownDecorationSets,
): MarkdownDecorationSets => {
  try {
    return buildMarkdownDecorations(state, ranges);
  } catch (error) {
    console.error("markdown decorations build failed", error);
    return previous;
  }
};

const markdownDecorationsPlugin = ViewPlugin.define<{
  sets: MarkdownDecorationSets;
  update: (update: ViewUpdate) => void;
}>((view) => {
  const plugin = {
    sets: buildOrKeep(view.state, view.visibleRanges, emptySets),
    update: (update: ViewUpdate): void => {
      // the parser finishing a large document in the background changes the
      // tree with neither flag set
      const treeChanged =
        syntaxTree(update.startState) !== syntaxTree(update.state);
      if (!update.docChanged && !update.viewportChanged && !treeChanged) return;
      plugin.sets = buildOrKeep(
        update.state,
        update.view.visibleRanges,
        update.docChanged ? emptySets : plugin.sets,
      );
    },
  };
  return plugin;
});

const decorationSource =
  (key: keyof MarkdownDecorationSets) =>
  (view: EditorView): DecorationSet =>
    view.plugin(markdownDecorationsPlugin)?.sets[key] ?? Decoration.none;

export const markdownDecorations = [
  markdownDecorationsPlugin,
  Prec.lowest(EditorView.decorations.of(decorationSource("lines"))),
  Prec.lowest(EditorView.decorations.of(decorationSource("marks"))),
  Prec.highest(EditorView.decorations.of(decorationSource("syntax"))),
];
