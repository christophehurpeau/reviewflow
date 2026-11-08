/**
 * Toggling bold, italic, code, strikethrough or a link over a selection inside
 * one line, as a pure string transform: the editor turns its selection into
 * offsets and applies the returned splice. Ported from
 * vscode-extension-markdown-beautiful-editor (`src/shared/inlineFormat.ts`).
 */
export type InlineFormat =
  | "bold"
  | "code"
  | "italic"
  | "link"
  | "strikethrough";

const markers: Record<Exclude<InlineFormat, "link">, string> = {
  bold: "**",
  italic: "*",
  code: "`",
  strikethrough: "~~",
};

/** how many of the marker's character sit right before `at` */
const runBefore = (text: string, at: number, marker: string): number => {
  const char = marker.charAt(0);
  let index = at;
  while (index > 0 && text.charAt(index - 1) === char) index--;
  return at - index;
};

const runAfter = (text: string, at: number, marker: string): number => {
  const char = marker.charAt(0);
  let index = at;
  while (index < text.length && text.charAt(index) === char) index++;
  return index - at;
};

/**
 * Whether a run of `*`, `~` or `` ` `` on both sides of the text applies the
 * format: `**` is bold and not italic, `***` both; a code span is delimited by
 * one backtick, which a run of two does not close.
 */
const isFormatted = (format: Exclude<InlineFormat, "link">, run: number) => {
  if (format === "italic") return run === 1 || run === 3;
  if (format === "code") return run === 1;
  return run >= 2;
};

const inlineLinkPattern = /^\[(?<label>[^\]]+)\]\([^)]+\)$/u;

export interface InlineFormatChangeInput {
  /** the whole line the selection is in */
  text: string;
  from: number;
  to: number;
  format: InlineFormat;
}

export interface InlineFormatChange {
  /** spliced over `[from, to)`, which can be wider than the selection when markers just outside it are consumed */
  insert: string;
  from: number;
  to: number;
  /** where the cursor lands, in the resulting line */
  selection: number;
}

/**
 * - `link` unwraps a selection that is exactly `[label](dest)`, and wraps
 *   anything else as `[selection](url)`.
 * - The others remove markers sitting just outside the selection, or wrapping
 *   it from inside, and wrap it otherwise.
 *
 * Null for an empty selection: there is nothing to toggle.
 */
export const inlineFormatChange = ({
  text,
  from,
  to,
  format,
}: InlineFormatChangeInput): InlineFormatChange | null => {
  const selected = text.slice(from, to);
  if (selected === "") return null;

  if (format === "link") {
    const label = inlineLinkPattern.exec(selected)?.groups?.label;
    const insert = label ?? `[${selected}](url)`;
    return { insert, from, to, selection: from + insert.length };
  }

  const marker = markers[format];
  const outside = Math.min(
    runBefore(text, from, marker),
    runAfter(text, to, marker),
  );
  if (isFormatted(format, outside)) {
    return {
      insert: selected,
      from: from - marker.length,
      to: to + marker.length,
      selection: from - marker.length + selected.length,
    };
  }

  const inside = Math.min(
    runAfter(selected, 0, marker),
    runBefore(selected, selected.length, marker),
  );
  if (isFormatted(format, inside) && selected.length > inside * 2) {
    const inner = selected.slice(marker.length, -marker.length);
    return { insert: inner, from, to, selection: from + inner.length };
  }

  const wrapped = `${marker}${selected}${marker}`;
  return { insert: wrapped, from, to, selection: from + wrapped.length };
};
