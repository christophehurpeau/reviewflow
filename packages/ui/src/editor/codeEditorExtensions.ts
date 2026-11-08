import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { json } from "@codemirror/lang-json";
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
import { externalUpdate, markdownLanguage } from "./extensions.ts";

export type CodeLanguage = "json" | "markdown";

interface CodeEditorExtensionsOptions {
  language: CodeLanguage;
  readOnly: boolean;
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
  onChange,
}: CodeEditorExtensionsOptions): Extension[] => [
  language === "json" ? json() : markdownLanguage(),
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
        ...(language === "json" ? [closeBrackets()] : []),
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
