import type {
  Completion,
  CompletionContext,
  CompletionResult,
} from "@codemirror/autocomplete";
import { autocompletion } from "@codemirror/autocomplete";
import { syntaxTree } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import type { SyntaxNode } from "@lezer/common";
import type { Gemoji } from "gemoji";
import { gemoji } from "gemoji";

const typedShortcode = /:[\w+-]+/;

/** A `:` after one of these is a time, a ratio or a key, not a shortcode. */
const glued = /[\w:]/;

/** GitHub renders no emoji inside these. */
const codeNodes = new Set([
  "CodeBlock",
  "CodeText",
  "FencedCode",
  "InlineCode",
]);

const maxOptions = 30;

const isInCode = (context: CompletionContext): boolean => {
  let node: SyntaxNode | null = syntaxTree(context.state).resolveInner(
    context.pos,
    -1,
  );
  while (node !== null) {
    if (codeNodes.has(node.name)) return true;
    node = node.parent;
  }
  return false;
};

interface Match {
  entry: Gemoji;
  name: string;
  /** lower is better: exact name, name prefix, tag prefix, name substring */
  rank: number;
  order: number;
}

const matchEntry = (
  entry: Gemoji,
  query: string,
  order: number,
): Match | null => {
  const exact = entry.names.find((name) => name === query);
  if (exact !== undefined) return { entry, name: exact, rank: 0, order };
  const prefixed = entry.names.find((name) => name.startsWith(query));
  if (prefixed !== undefined) return { entry, name: prefixed, rank: 1, order };
  const [primary = ""] = entry.names;
  if (entry.tags.some((tag) => tag.startsWith(query))) {
    return { entry, name: primary, rank: 2, order };
  }
  if (query.length < 2) return null;
  const containing = entry.names.find((name) => name.includes(query));
  if (containing !== undefined) {
    return { entry, name: containing, rank: 3, order };
  }
  return null;
};

/** The emoji a typed `:query` names, best first, as GitHub's own box offers them. */
export const emojiMatches = (
  query: string,
): { emoji: string; name: string }[] =>
  gemoji
    .map((entry, order) => matchEntry(entry, query.toLowerCase(), order))
    .filter((match) => match !== null)
    .toSorted(
      (a, b) =>
        a.rank - b.rank || a.name.length - b.name.length || a.order - b.order,
    )
    .slice(0, maxOptions)
    .map(({ entry, name }) => ({ emoji: entry.emoji, name }));

/**
 * Completes a `:shortcode:` as GitHub's comment box does, inserting the
 * shortcode rather than the character: the source stays what GitHub's own
 * editor would have written, and both render the same.
 */
export const emojiCompletionSource = (
  context: CompletionContext,
): CompletionResult | null => {
  const typed = context.matchBefore(typedShortcode);
  if (typed === null) return null;
  const before =
    typed.from === 0 ? "" : context.state.sliceDoc(typed.from - 1, typed.from);
  if (glued.test(before) || isInCode(context)) return null;

  const options: Completion[] = emojiMatches(typed.text.slice(1)).map(
    ({ emoji, name }) => ({
      label: `:${name}:`,
      displayLabel: `${emoji}  :${name}:`,
    }),
  );
  if (options.length === 0) return null;
  return { from: typed.from, options, filter: false };
};

export const emojiCompletion: Extension = autocompletion({
  override: [emojiCompletionSource],
  icons: false,
});
