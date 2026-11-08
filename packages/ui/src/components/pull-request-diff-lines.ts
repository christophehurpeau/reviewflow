import type { FileDiffMetadata, SelectedLineRange } from "@pierre/diffs";
import type { PullRequestDiffSide } from "@reviewflow/sdk";

export interface LineAnchor {
  path: string;
  side: PullRequestDiffSide;
  line: number;
  /** the first line of a range; null for one line */
  startLine: number | null;
  startSide: PullRequestDiffSide | null;
}

/** The comment being written on a diff, at most one at a time. */
export interface Composer {
  fileKey: string;
  anchor: LineAnchor;
  range: SelectedLineRange;
}

export const annotationSideOf = (
  side: PullRequestDiffSide,
): "additions" | "deletions" => (side === "RIGHT" ? "additions" : "deletions");

const sideOf = (side: "additions" | "deletions"): PullRequestDiffSide =>
  side === "additions" ? "RIGHT" : "LEFT";

/**
 * A drag can end above where it started. Within one side that is a swap; across
 * the two sides of a unified diff the order is the reader's and is kept.
 */
export const anchorOfRange = (
  path: string,
  { start, end, side = "additions", endSide }: SelectedLineRange,
): LineAnchor => {
  const last = endSide ?? side;
  const swapped = side === last && start > end;
  const from = swapped ? end : start;
  const to = swapped ? start : end;
  const single = from === to && side === last;
  return {
    path,
    side: sideOf(last),
    line: to,
    startLine: single ? null : from,
    startSide: single ? null : sideOf(side),
  };
};

const stripEol = (line: string): string => line.replace(/\r?\n$/, "");

const rightLine = (
  file: FileDiffMetadata,
  lineNumber: number,
): string | null => {
  const hunk = file.hunks.find(
    ({ additionStart, additionCount }) =>
      lineNumber >= additionStart && lineNumber < additionStart + additionCount,
  );
  if (hunk === undefined) return null;
  const line =
    file.additionLines[
      hunk.additionLineIndex + lineNumber - hunk.additionStart
    ];
  return line === undefined ? null : stripEol(line);
};

/**
 * The new-file lines an anchor covers, for a suggestion block. Null when the
 * range touches the old side or a line the patch does not carry (a gap
 * between hunks), where a suggestion would replace text it never showed.
 */
export const rightSideLines = (
  file: FileDiffMetadata,
  anchor: LineAnchor,
): string[] | null => {
  if (anchor.side !== "RIGHT") return null;
  if (anchor.startSide !== null && anchor.startSide !== "RIGHT") return null;
  const first = anchor.startLine ?? anchor.line;
  const lines: string[] = [];
  for (let number = first; number <= anchor.line; number += 1) {
    const line = rightLine(file, number);
    if (line === null) return null;
    lines.push(line);
  }
  return lines;
};

/** Whether a hunk of the patch carries the line on that side, context included. */
export const isLineInPatch = (
  file: FileDiffMetadata,
  side: PullRequestDiffSide,
  line: number,
): boolean =>
  file.hunks.some((hunk) =>
    side === "RIGHT"
      ? line >= hunk.additionStart &&
        line < hunk.additionStart + hunk.additionCount
      : line >= hunk.deletionStart &&
        line < hunk.deletionStart + hunk.deletionCount,
  );

export const suggestionBlock = (lines: string[]): string =>
  `\`\`\`suggestion\n${lines.join("\n")}\n\`\`\``;
