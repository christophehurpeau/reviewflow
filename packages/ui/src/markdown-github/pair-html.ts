import type {
  BlockNode,
  BreakNode,
  CodeBlockNode,
  CodeSpanNode,
  FootnoteReferenceNode,
  ImageNode,
  InlineNode,
  TableCellNode,
  TextNode,
  ThematicBreakNode,
} from "@tanstack/markdown";
import { parseMarkdown } from "@tanstack/markdown/parser";
import {
  type HtmlToken,
  decodeEntities,
  textAfterLeadingComments,
  tokenizeHtml,
} from "./html-tokens.ts";
import type { TaskSignature } from "./toggle-task.ts";
import { taskSignature } from "./toggle-task.ts";

/**
 * GitHub allows HTML in a comment, and `@tanstack/markdown` (with `allowHtml`)
 * hands it over as CommonMark does: a tag is a sibling node of its content, not
 * its parent. `<details>` is in one `html` node, the markdown it wraps is
 * ordinary nodes, and `</details>` is in a later `html` node; inline,
 * `<sub>`, `x` and `</sub>` are three siblings.
 *
 * This turns each run of siblings into a tree, pairing an open tag with its
 * close across them. Everything else about the AST is kept, so a renderer only
 * has one extra node type, `element`.
 */

export interface GhElement {
  type: "element";
  tag: string;
  attrs: Record<string, string>;
  children: GhBlockNode[];
}

export type GhInlineNode =
  | BreakNode
  | CodeSpanNode
  | FootnoteReferenceNode
  | GhElement
  | ImageNode
  | TextNode
  | { type: "emphasis" | "strike" | "strong"; children: GhInlineNode[] }
  | { type: "link"; href: string; title?: string; children: GhInlineNode[] };

export interface GhListItem {
  type: "listItem";
  checked?: boolean;
  /** Position among every task item of the document, in source order. */
  taskIndex?: number;
  children: GhBlockNode[];
}

export interface GhTableCell {
  type: "tableCell";
  children: GhInlineNode[];
}

/**
 * Inline nodes are part of the union: the raw text inside an html block, such
 * as the `Click` of `<summary>Click</summary>`, sits among blocks.
 */
export type GhBlockNode =
  | CodeBlockNode
  | GhInlineNode
  | ThematicBreakNode
  | {
      type: "table";
      header: GhTableCell[];
      rows: GhTableCell[][];
    }
  | { type: "blockquote"; children: GhBlockNode[] }
  | { type: "callout"; kind: string; title: string; children: GhBlockNode[] }
  | { type: "heading"; depth: 1 | 2 | 3 | 4 | 5 | 6; children: GhInlineNode[] }
  | { type: "list"; ordered: boolean; start?: number; items: GhListItem[] }
  | { type: "paragraph"; children: GhInlineNode[] };

export interface PairedDocument {
  children: GhBlockNode[];
  taskCount: number;
  /** each task item's state and first line, by `taskIndex`, for `toggleTask` */
  tasks: TaskSignature[];
}

const inlineTags = new Set([
  "a",
  "abbr",
  "b",
  "big",
  "br",
  "cite",
  "code",
  "del",
  "em",
  "i",
  "img",
  "ins",
  "kbd",
  "mark",
  "q",
  "s",
  "samp",
  "small",
  "span",
  "strike",
  "strong",
  "sub",
  "sup",
  "tt",
  "u",
  "var",
]);

const inlineTypes = new Set<string>([
  "text",
  "inlineCode",
  "footnoteReference",
  "image",
  "break",
  "strong",
  "emphasis",
  "strike",
  "link",
]);

/** Whether a node belongs in a run of text rather than stacked as a block. */
export const isInlineNode = (node: GhBlockNode): boolean =>
  inlineTypes.has(node.type) ||
  (node.type === "element" && inlineTags.has(node.tag));

interface Frame {
  tag: string;
  attrs: Record<string, string>;
  children: GhBlockNode[];
}

const trimEdges = (children: GhBlockNode[]): void => {
  const first = children[0];
  if (first?.type === "text") first.value = first.value.trimStart();
  const last = children.at(-1);
  if (last?.type === "text") last.value = last.value.trimEnd();
};

/** A stack of open tags over one run of siblings. */
const createBuilder = (blockContext: boolean) => {
  const root: Frame = { tag: "", attrs: {}, children: [] };
  const stack: Frame[] = [root];
  const top = (): Frame => stack.at(-1) ?? root;

  const pop = (): void => {
    const frame = stack.pop();
    if (frame === undefined) return;
    trimEdges(frame.children);
    top().children.push({
      type: "element",
      tag: frame.tag,
      attrs: frame.attrs,
      children: frame.children,
    });
  };

  const addText = (raw: string): void => {
    const inPre = stack.some((frame) => frame.tag === "pre");
    const value = inPre ? raw : raw.replaceAll(/\s+/g, " ");
    if (value === "") return;
    if (!inPre && value.trim() === "") {
      const last = top().children.at(-1);
      const afterInline = last !== undefined && isInlineNode(last);
      if (blockContext && !afterInline) return;
    }
    top().children.push({ type: "text", value });
  };

  return {
    append: (node: GhBlockNode): void => {
      top().children.push(node);
    },
    html: (value: string): void => {
      tokenizeHtml(
        value,
        stack.slice(1).map((frame) => frame.tag),
      ).forEach((token: HtmlToken) => {
        if (token.kind === "text") {
          addText(token.value);
        } else if (token.kind === "open") {
          stack.push({ tag: token.tag, attrs: token.attrs, children: [] });
        } else {
          // A stray close has no open tag to match and is ignored; one that
          // matches a deeper tag also closes what was left open above it.
          const index = stack.findLastIndex((frame) => frame.tag === token.tag);
          while (index > 0 && stack.length > index) pop();
        }
      });
    },
    finish: (): GhBlockNode[] => {
      while (stack.length > 1) pop();
      return root.children;
    },
  };
};

interface PairContext {
  taskCount: number;
  tasks: TaskSignature[];
}

const pairInlines = (nodes: InlineNode[]): GhInlineNode[] => {
  const builder = createBuilder(false);

  nodes.forEach((node) => {
    switch (node.type) {
      case "inlineHtml":
        builder.html(node.value);
        break;
      case "strong":
      case "emphasis":
      case "strike":
        builder.append({
          type: node.type,
          children: pairInlines(node.children),
        });
        break;
      case "link":
        builder.append({
          type: "link",
          href: node.href,
          title: node.title,
          children: pairInlines(node.children),
        });
        break;
      case "text":
        builder.append({ type: "text", value: decodeEntities(node.value) });
        break;
      case "inlineCode":
      case "footnoteReference":
      case "image":
      case "break":
        builder.append(node);
        break;
      default:
        break;
    }
  });

  return builder.finish() as GhInlineNode[];
};

const pairCell = (cell: TableCellNode): GhTableCell => ({
  type: "tableCell",
  children: pairInlines(cell.children),
});

const withoutLeadingComments = (nodes: BlockNode[]): BlockNode[] =>
  nodes.flatMap((node): BlockNode[] => {
    const rest =
      node.type === "html" ? textAfterLeadingComments(node.value) : null;
    return rest === null
      ? [node]
      : withoutLeadingComments(
          parseMarkdown(rest, { allowHtml: true }).children,
        );
  });

const pairBlocks = (
  nodes: BlockNode[],
  context: PairContext,
): GhBlockNode[] => {
  const builder = createBuilder(true);

  withoutLeadingComments(nodes).forEach((node) => {
    switch (node.type) {
      case "html":
        builder.html(node.value);
        break;
      case "paragraph":
        builder.append({
          type: "paragraph",
          children: pairInlines(node.children),
        });
        break;
      case "heading":
        builder.append({
          type: "heading",
          depth: node.depth,
          children: pairInlines(node.children),
        });
        break;
      case "code":
      case "thematicBreak":
        builder.append(node);
        break;
      case "list": {
        const items = node.items.map((item): GhListItem => {
          // The marker comes before the item's content, so number it first.
          const taskIndex =
            item.checked === undefined ? undefined : context.taskCount++;
          if (taskIndex !== undefined) context.tasks.push(taskSignature(item));
          return {
            type: "listItem",
            checked: item.checked,
            taskIndex,
            children: pairBlocks(item.children, context),
          };
        });
        builder.append({
          type: "list",
          ordered: node.ordered,
          start: node.start,
          items,
        });
        break;
      }
      case "blockquote":
        builder.append({
          type: "blockquote",
          children: pairBlocks(node.children, context),
        });
        break;
      case "callout":
        builder.append({
          type: "callout",
          kind: node.kind,
          title: node.title,
          children: pairBlocks(node.children, context),
        });
        break;
      case "table":
        builder.append({
          type: "table",
          header: node.header.map(pairCell),
          rows: node.rows.map((row) => row.map(pairCell)),
        });
        break;
      case "footnotes":
      case "component":
      default:
        break;
    }
  });

  return builder.finish();
};

export const pairGithubHtml = (nodes: BlockNode[]): PairedDocument => {
  const context: PairContext = { taskCount: 0, tasks: [] };
  const children = pairBlocks(nodes, context);
  return { children, taskCount: context.taskCount, tasks: context.tasks };
};
