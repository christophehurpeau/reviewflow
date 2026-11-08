import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import {
  commonmarkLanguage,
  markdown,
  markdownKeymap,
} from "@codemirror/lang-markdown";
import { yaml } from "@codemirror/lang-yaml";
import { LanguageDescription } from "@codemirror/language";
import {
  highlightSelectionMatches,
  search,
  searchKeymap,
} from "@codemirror/search";
import type { Extension } from "@codemirror/state";
import { Annotation, EditorState, Prec } from "@codemirror/state";
import { EditorView, drawSelection, keymap } from "@codemirror/view";
import { GFM } from "@lezer/markdown";
import { codeHighlighting } from "./codeHighlight.ts";
import { formattingKeymap } from "./commands.ts";
import { markdownDecorations } from "./decorations.ts";
import { emojiCompletion } from "./emojiCompletion.ts";
import { frontmatter } from "./frontmatter.ts";

/**
 * Bundled statically: `lang-markdown` already depends on `lang-html`, which
 * brings `lang-javascript` and `lang-css`, so only json and yaml add weight.
 */
const codeLanguages = [
  LanguageDescription.of({
    name: "typescript",
    alias: ["ts"],
    support: javascript({ typescript: true }),
  }),
  LanguageDescription.of({
    name: "tsx",
    support: javascript({ typescript: true, jsx: true }),
  }),
  LanguageDescription.of({
    name: "javascript",
    alias: ["js", "mjs", "cjs"],
    support: javascript(),
  }),
  LanguageDescription.of({ name: "jsx", support: javascript({ jsx: true }) }),
  LanguageDescription.of({ name: "json", support: json() }),
  LanguageDescription.of({ name: "html", support: html() }),
  LanguageDescription.of({ name: "css", support: css() }),
  LanguageDescription.of({ name: "yaml", alias: ["yml"], support: yaml() }),
];

/**
 * The markdown language with GFM and frontmatter. GFM has to go through
 * `markdown()`'s `extensions` option: configuring the raw parser with it is a
 * silent no-op. HTML tag completion, which `lang-html` would bring, is off —
 * this is a prose editor.
 */
export const markdownLanguage = (): Extension =>
  markdown({
    base: commonmarkLanguage,
    extensions: [GFM, frontmatter],
    codeLanguages,
    completeHTMLTags: false,
    addKeymap: false,
  });

/**
 * Marks a change that came from the caller's `value` rather than from typing,
 * so it is not reported back through `onChange`.
 */
export const externalUpdate = Annotation.define<boolean>();

/**
 * The single change turning `current` into `next`: the common prefix and
 * suffix are kept, so the selection and the undo history outside the changed
 * span survive. A character diff would find a smaller edit and take minutes on
 * a large replacement.
 */
export const changeBetween = (
  current: string,
  next: string,
): { from: number; to: number; insert: string } | null => {
  if (current === next) return null;
  const limit = Math.min(current.length, next.length);
  let prefix = 0;
  while (prefix < limit && current[prefix] === next[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < limit - prefix &&
    current[current.length - 1 - suffix] === next[next.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  return {
    from: prefix,
    to: current.length - suffix,
    insert: next.slice(prefix, next.length - suffix),
  };
};

interface MarkdownEditorExtensionsOptions {
  readOnly: boolean;
  /** `:shortcode:` completion, for a body GitHub renders */
  emoji: boolean;
  onChange: (value: string) => void;
}

/**
 * Everything the editor is, chosen once at mount: read-only is not toggled on
 * a live view, the caller remounts instead.
 */
export const markdownEditorExtensions = ({
  readOnly,
  emoji,
  onChange,
}: MarkdownEditorExtensionsOptions): Extension[] => [
  markdownLanguage(),
  codeHighlighting,
  markdownDecorations,
  EditorView.lineWrapping,
  drawSelection(),
  highlightSelectionMatches(),
  search({ top: true }),
  EditorState.readOnly.of(readOnly),
  EditorView.editable.of(!readOnly),
  ...(readOnly
    ? [keymap.of([...searchKeymap, ...defaultKeymap])]
    : [
        history(),
        ...(emoji ? [emojiCompletion] : []),
        Prec.high(keymap.of(formattingKeymap)),
        keymap.of([
          ...markdownKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...defaultKeymap,
        ]),
        EditorView.updateListener.of((update) => {
          const typed = update.transactions.some(
            (transaction) =>
              transaction.docChanged &&
              transaction.annotation(externalUpdate) !== true,
          );
          if (typed) onChange(update.state.doc.toString());
        }),
      ]),
];
