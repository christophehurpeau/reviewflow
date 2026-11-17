import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { yaml } from "@codemirror/lang-yaml";
import { bracketMatching, indentOnInput } from "@codemirror/language";
import {
  highlightSelectionMatches,
  search,
  searchKeymap,
} from "@codemirror/search";
import type { Extension } from "@codemirror/state";
import { EditorState } from "@codemirror/state";
import { EditorView, drawSelection, keymap } from "@codemirror/view";
import { codeHighlighting } from "./codeHighlight.ts";
import {
  externalUpdate,
  lineNumberGutter,
  markdownLanguage,
} from "./extensions.ts";

export type CodeLanguage =
  | "css"
  | "html"
  | "javascript"
  | "json"
  | "jsx"
  | "markdown"
  /** no grammar: the text as it is, for any extension not listed */
  | "plain"
  | "tsx"
  | "typescript"
  | "yaml";

const languageByExtension: Record<string, CodeLanguage> = {
  cjs: "javascript",
  css: "css",
  cts: "typescript",
  htm: "html",
  html: "html",
  js: "javascript",
  json: "json",
  jsonc: "json",
  jsx: "jsx",
  markdown: "markdown",
  md: "markdown",
  mdx: "markdown",
  mjs: "javascript",
  mts: "typescript",
  ts: "typescript",
  tsx: "tsx",
  yaml: "yaml",
  yml: "yaml",
};

/** The language a file is edited in, by its extension; `plain` for any other. */
export const codeLanguageOfPath = (path: string): CodeLanguage => {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return "plain";
  return languageByExtension[name.slice(dot + 1).toLowerCase()] ?? "plain";
};

const languageExtensions: Record<CodeLanguage, () => Extension> = {
  css: () => css(),
  html: () => html(),
  javascript: () => javascript(),
  json: () => json(),
  jsx: () => javascript({ jsx: true }),
  markdown: () => markdownLanguage(),
  plain: () => [],
  tsx: () => javascript({ jsx: true, typescript: true }),
  typescript: () => javascript({ typescript: true }),
  yaml: () => yaml(),
};

const languageExtension = (language: CodeLanguage): Extension =>
  languageExtensions[language]();

/** Brackets and quotes are closed as typed in code, never in prose. */
const closesBrackets = (language: CodeLanguage): boolean =>
  language !== "markdown" && language !== "plain";

interface CodeEditorExtensionsOptions {
  language: CodeLanguage;
  readOnly: boolean;
  /** `lineNumberGutter` */
  lineNumbers: boolean;
  onChange: (value: string) => void;
}

/**
 * Plain code on the markdown editor's base: the same highlighting classes and
 * the same frame (`markdown-editor.css`), but no styling of the text in place —
 * the text is shown as it is. Chosen once at mount, like the markdown editor's:
 * a caller switching `language` or `readOnly` remounts by key.
 */
export const codeEditorExtensions = ({
  language,
  readOnly,
  lineNumbers,
  onChange,
}: CodeEditorExtensionsOptions): Extension[] => [
  ...(lineNumbers ? [lineNumberGutter] : []),
  languageExtension(language),
  codeHighlighting,
  EditorView.lineWrapping,
  drawSelection(),
  bracketMatching(),
  highlightSelectionMatches(),
  search({ top: true }),
  EditorState.readOnly.of(readOnly),
  EditorView.editable.of(!readOnly),
  ...(readOnly
    ? [keymap.of([...searchKeymap, ...defaultKeymap])]
    : [
        history(),
        indentOnInput(),
        ...(closesBrackets(language) ? [closeBrackets()] : []),
        keymap.of([
          ...closeBracketsKeymap,
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
