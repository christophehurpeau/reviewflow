import type { BlockNode, InlineNode, ListItemNode } from "@tanstack/markdown";
import { parseMarkdown } from "@tanstack/markdown/parser";

/**
 * The source with the `taskIndex`th task-list marker (`[ ]`, `[x]`, `[X]`
 * after a list bullet) flipped, or `null` when it cannot be done safely.
 *
 * The parser reports which list items are tasks but not where they are in the
 * source, so the markers are found again by scanning lines. A scan and a parser
 * can disagree (an indented code block, an html block, a lazy quote), and two
 * disagreements can cancel out in a count. Flipping the wrong box in someone's
 * pull request description is worse than flipping none: each marker found must
 * match the parser's task of the same rank, its state and its first line of
 * text (`expected`), else the boxes stay read-only.
 */

const fence = /^[\s>]*(`{3,}|~{3,})/;
const task = /^([\s>]*(?:(?:[*+-]|\d{1,9}[.)])[ \t]+)+\[)([ x])(\](?:\s|$))/i;
/** CommonMark html blocks of kinds 6 and 7, which end at a blank line */
const htmlBlockStart = /^ {0,3}<\/?[a-z][\w-]*(?:\s|\/?>|$)/i;

export interface TaskSignature {
  checked: boolean;
  /** the plain text of the item's first line */
  text: string;
}

const plainText = (nodes: readonly InlineNode[]): string =>
  nodes
    .map((node): string => {
      switch (node.type) {
        case "text":
        case "inlineCode":
          return node.value;
        case "image":
          return node.alt;
        case "break":
          return "\n";
        case "emphasis":
        case "link":
        case "strike":
        case "strong":
          return plainText(node.children);
        case "inlineHtml":
        case "footnoteReference":
          return "";
        default:
          return node satisfies never;
      }
    })
    .join("");

const firstLineOf = (blocks: readonly BlockNode[]): string => {
  const first = blocks[0];
  const text =
    first?.type === "paragraph" || first?.type === "heading"
      ? plainText(first.children)
      : "";
  return (text.split("\n")[0] ?? "").replaceAll(/\s+/g, " ").trim();
};

export const taskSignature = (item: ListItemNode): TaskSignature => ({
  checked: item.checked === true,
  text: firstLineOf(item.children),
});

const lineSignature = (line: string): TaskSignature | null => {
  const match = task.exec(line);
  if (match === null) return null;
  const rest = line.slice(match[0].length);
  return {
    checked: match[2] !== " ",
    text: firstLineOf(parseMarkdown(rest, { allowHtml: true }).children),
  };
};

interface OpenFence {
  char: string;
  length: number;
}

const closesFence = (line: string, open: OpenFence): boolean => {
  const match = fence.exec(line);
  const marker = match?.[1];
  return (
    marker !== undefined &&
    marker.startsWith(open.char) &&
    marker.length >= open.length &&
    line.slice(match?.[0].length).trim() === ""
  );
};

const opensFence = (line: string): OpenFence | null => {
  const match = fence.exec(line);
  const marker = match?.[1];
  if (marker === undefined) return null;
  // A backtick fence's info string cannot hold a backtick: that is inline code.
  if (marker.startsWith("`") && line.slice(match?.[0].length).includes("`")) {
    return null;
  }
  return { char: marker.charAt(0), length: marker.length };
};

const scanMarkers = (lines: readonly string[]): number[] => {
  const markers: number[] = [];
  let open: OpenFence | null = null;
  let inHtmlBlock = false;

  lines.forEach((line, index) => {
    if (open) {
      if (closesFence(line, open)) open = null;
      return;
    }
    if (inHtmlBlock) {
      inHtmlBlock = line.trim() !== "";
      return;
    }
    open = opensFence(line);
    if (open) return;
    if (htmlBlockStart.test(line)) {
      inHtmlBlock = true;
      return;
    }
    if (task.test(line)) markers.push(index);
  });
  return markers;
};

const matchesParser = (
  lines: readonly string[],
  markers: readonly number[],
  expected: readonly TaskSignature[],
): boolean =>
  markers.length === expected.length &&
  markers.every((lineIndex, rank) => {
    const found = lineSignature(lines[lineIndex]?.replace(/\r$/, "") ?? "");
    const wanted = expected[rank];
    return (
      found !== null &&
      wanted !== undefined &&
      found.checked === wanted.checked &&
      found.text === wanted.text
    );
  });

export const toggleTask = (
  source: string,
  taskIndex: number,
  expected?: readonly TaskSignature[],
): string | null => {
  const lines = source.split("\n");
  const markers = scanMarkers(lines);

  if (expected !== undefined && !matchesParser(lines, markers, expected)) {
    return null;
  }
  const lineIndex = markers[taskIndex];
  if (lineIndex === undefined) return null;

  const line = lines[lineIndex] ?? "";
  const checked = task.exec(line)?.[2] !== " ";
  lines[lineIndex] = line.replace(task, checked ? "$1 $3" : "$1x$3");
  return lines.join("\n");
};
