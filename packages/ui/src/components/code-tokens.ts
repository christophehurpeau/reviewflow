import { LanguageDescription } from "@codemirror/language";
import { highlightTree, tagHighlighter } from "@lezer/highlight";
import { codeTokenStyles } from "../editor/codeHighlight.ts";
import { codeLanguages } from "../editor/extensions.ts";
import "../editor/code-token-colors.css";

/**
 * A code block's text cut into tokens, for `CopyableCodeBlock` to color: the
 * editor's parsers and token roles, so a fence reads the same rendered as in
 * the editor. `className` is a full class literal, which tailwind finds here.
 */
export interface CodeToken {
  from: number;
  text: string;
  className: string | null;
}

const tokenClasses: Record<string, string> = {
  "tok-comment": "italic text-(color:--md-tok-comment)",
  "tok-keyword": "text-(color:--md-tok-keyword)",
  "tok-operator": "text-(color:--md-tok-keyword)",
  "tok-string": "text-(color:--md-tok-string)",
  "tok-constant": "text-(color:--md-tok-constant)",
  "tok-property": "text-(color:--md-tok-property)",
  "tok-type": "text-(color:--md-tok-type)",
  "tok-function": "text-(color:--md-tok-function)",
  "tok-invalid": "underline decoration-wavy text-(color:--md-tok-invalid)",
};

const tokenHighlighter = tagHighlighter(
  codeTokenStyles.map(({ tag, class: name }) => ({ tag, class: name ?? "" })),
);

/** null for a language the editor has no parser for: the block stays plain */
export const highlightCode = (
  language: string | undefined,
  code: string,
): CodeToken[] | null => {
  if (language === undefined || language === "") return null;
  const parser = LanguageDescription.matchLanguageName(codeLanguages, language)
    ?.support?.language.parser;
  if (parser === undefined) return null;

  const tokens: CodeToken[] = [];
  let at = 0;
  highlightTree(parser.parse(code), tokenHighlighter, (from, to, classes) => {
    if (from > at) {
      tokens.push({ from: at, text: code.slice(at, from), className: null });
    }
    const role = classes.split(" ").find((name) => name in tokenClasses);
    tokens.push({
      from,
      text: code.slice(from, to),
      className: role === undefined ? null : (tokenClasses[role] ?? null),
    });
    at = to;
  });
  if (at < code.length) {
    tokens.push({ from: at, text: code.slice(at), className: null });
  }
  return tokens;
};
