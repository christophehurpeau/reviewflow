import { cssLanguage } from "@codemirror/lang-css";
import { htmlLanguage } from "@codemirror/lang-html";
import { javascriptLanguage } from "@codemirror/lang-javascript";
import { jsonLanguage } from "@codemirror/lang-json";
import { yamlLanguage } from "@codemirror/lang-yaml";
import type { TagStyle } from "@codemirror/language";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { tags } from "@lezer/highlight";

/**
 * Token classes for the code inside a fence and for the frontmatter's yaml.
 * **Every style is scoped to a nested language**: `@lezer/markdown` tags its
 * own nodes too (`heading1`, `strong`), and an unscoped style would paint prose
 * a second time over the `md-*` classes. Classes, not colours: the palette is
 * in `code-token-colors.css`, generated with the diff's reviewflow theme
 * (`build-code-theme.ts`), switched with the theme.
 *
 * Coarse on purpose — a parent tag catches its children, so a language emitting
 * a tag nobody listed still lands somewhere sensible. Ported from
 * vscode-extension-markdown-beautiful-editor (`src/webview/cm/codeHighlight.ts`).
 */
const codeTokenStyles: TagStyle[] = [
  { tag: tags.comment, class: "tok-comment" },
  { tag: tags.keyword, class: "tok-keyword" },
  { tag: tags.string, class: "tok-string" },
  {
    tag: [
      tags.number,
      tags.bool,
      tags.null,
      tags.atom,
      tags.unit,
      tags.color,
      tags.url,
      tags.regexp,
      tags.escape,
    ],
    class: "tok-constant",
  },
  { tag: tags.propertyName, class: "tok-property" },
  {
    tag: [tags.typeName, tags.className, tags.namespace, tags.labelName],
    class: "tok-type",
  },
  {
    tag: [
      tags.function(tags.variableName),
      tags.function(tags.propertyName),
      tags.macroName,
    ],
    class: "tok-function",
  },
  { tag: tags.operator, class: "tok-operator" },
  { tag: tags.invalid, class: "tok-invalid" },
];

const scopedLanguages = [
  cssLanguage,
  htmlLanguage,
  javascriptLanguage,
  jsonLanguage,
  yamlLanguage,
];

export const codeHighlighters = scopedLanguages.map((language) =>
  HighlightStyle.define(codeTokenStyles, { scope: language }),
);

export const codeHighlighting: Extension = codeHighlighters.map((highlighter) =>
  syntaxHighlighting(highlighter),
);
