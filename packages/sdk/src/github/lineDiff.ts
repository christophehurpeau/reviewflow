export type DiffLineKind = "added" | "context" | "removed";

export interface DiffLine {
  kind: DiffLineKind;
  text: string;
}

/**
 * Past this many cells the table is not built at all and the two sides are
 * emitted whole — every old line removed, then every new line added. Still a
 * correct diff, only not a minimal one, and 400×400 is well past anything an
 * `Edit` has measured (153 lines is the largest) once the common prefix and
 * suffix are off. The cap is in cells rather than lines because that is what
 * the allocation is: a 1200-line cap on each side would allow a 5.7MB transient
 * array, several times per page.
 */
const maxDiffCells = 160_000;

/** A file that ends in a newline is not a file with a blank last line. */
const toLines = (value: string): string[] => {
  if (value === "") return [];
  const lines = value.split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines;
};

const context = (text: string): DiffLine => ({ kind: "context", text });
const removed = (text: string): DiffLine => ({ kind: "removed", text });
const added = (text: string): DiffLine => ({ kind: "added", text });

const wholeSides = (before: string[], after: string[]): DiffLine[] => [
  ...before.map(removed),
  ...after.map(added),
];

/**
 * The shortest edit script between two runs that share neither their first nor
 * their last line, by the longest common subsequence of them.
 *
 * At a position where a removal and an addition both apply, the removal is
 * emitted first — git's order, and the one that lets the two be read as a
 * replacement of each other.
 */
const shortestEdit = (before: string[], after: string[]): DiffLine[] => {
  const height = before.length;
  const width = after.length + 1;
  const common = new Uint32Array((height + 1) * width);

  for (let row = height - 1; row >= 0; row--) {
    const beforeLine = before[row];
    for (let column = after.length - 1; column >= 0; column--) {
      common[row * width + column] =
        beforeLine === after[column]
          ? (common[(row + 1) * width + column + 1] ?? 0) + 1
          : Math.max(
              common[(row + 1) * width + column] ?? 0,
              common[row * width + column + 1] ?? 0,
            );
    }
  }

  const lines: DiffLine[] = [];
  let row = 0;
  let column = 0;

  while (row < height && column < after.length) {
    if (before[row] === after[column]) {
      lines.push(context(before[row] ?? ""));
      row++;
      column++;
      continue;
    }
    if (
      (common[(row + 1) * width + column] ?? 0) >=
      (common[row * width + column + 1] ?? 0)
    ) {
      lines.push(removed(before[row] ?? ""));
      row++;
      continue;
    }
    lines.push(added(after[column] ?? ""));
    column++;
  }

  return [
    ...lines,
    ...before.slice(row).map(removed),
    ...after.slice(column).map(added),
  ];
};

/**
 * The two sides of a change, line by line.
 *
 * **The common prefix and suffix come off first**, and that is the guard that
 * does the real work rather than the cell cap below it: Claude Code's
 * `old_string` and `new_string` are a fragment and its replacement, and a
 * fragment is chosen to be unique, which means it almost always opens and
 * closes on lines the replacement keeps. Trimming them is O(n+m) and allocates
 * nothing, and it collapses nearly every measured edit to a handful of lines
 * before the table is sized.
 *
 * A whole new file is `before: ""`, which trims to nothing and comes back as
 * every line added.
 */
export const diffLines = ({
  before,
  after,
}: {
  before: string;
  after: string;
}): DiffLine[] => {
  const beforeLines = toLines(before);
  const afterLines = toLines(after);

  let head = 0;
  while (
    head < beforeLines.length &&
    head < afterLines.length &&
    beforeLines[head] === afterLines[head]
  ) {
    head++;
  }

  let tail = 0;
  while (
    tail < beforeLines.length - head &&
    tail < afterLines.length - head &&
    beforeLines[beforeLines.length - 1 - tail] ===
      afterLines[afterLines.length - 1 - tail]
  ) {
    tail++;
  }

  const beforeMiddle = beforeLines.slice(head, beforeLines.length - tail);
  const afterMiddle = afterLines.slice(head, afterLines.length - tail);

  return [
    ...beforeLines.slice(0, head).map(context),
    ...(beforeMiddle.length * afterMiddle.length > maxDiffCells
      ? wholeSides(beforeMiddle, afterMiddle)
      : shortestEdit(beforeMiddle, afterMiddle)),
    ...beforeLines.slice(beforeLines.length - tail).map(context),
  ];
};
