/**
 * Lezer node name → `md-*` class, as data: a construct is styled by adding a
 * row here, not a branch to the walk in `decorations.ts`.
 *
 * - `mark`: over the node's whole range, at the lowest precedence, so it is the
 *   outer element of every overlay (search match, selection).
 * - `syntax`: over a delimiter leaf (`**`, `#`, `>`), at the highest
 *   precedence, so it renders *inside* the construct's mark and can be muted
 *   there.
 * - `line`: on every line the node touches. Anything needing a block box — a
 *   background, a border, padding — is a line class, because a mark is split
 *   at line boundaries.
 *
 * The nodes whose class depends on context (`Task`, `TableCell`,
 * `TableDelimiter`, `LinkLabel`, `LinkTitle`) are absent on purpose and handled
 * in `decorations.ts`. Ported from vscode-extension-markdown-beautiful-editor
 * (`src/shared/nodeClassMap.ts`), without math, footnotes and definition lists,
 * whose grammars are not installed here.
 */
export type NodeDecorationLayer = "line" | "mark" | "syntax";

export interface NodeClassEntry {
  layer: NodeDecorationLayer;
  className: string;
}

const nodeClasses: Readonly<Record<string, NodeClassEntry>> = {
  StrongEmphasis: { layer: "mark", className: "md-bold" },
  Emphasis: { layer: "mark", className: "md-italic" },
  InlineCode: { layer: "mark", className: "md-code" },
  Escape: { layer: "mark", className: "md-escaped" },
  Strikethrough: { layer: "mark", className: "md-strike" },
  Autolink: { layer: "mark", className: "md-autolink" },
  Link: { layer: "mark", className: "md-link" },
  Image: { layer: "mark", className: "md-image" },
  LinkReference: { layer: "mark", className: "md-link-def" },
  ListItem: { layer: "mark", className: "md-list" },
  Table: { layer: "mark", className: "md-table" },
  CodeInfo: { layer: "mark", className: "md-code-info" },

  ATXHeading1: { layer: "line", className: "md-heading md-h1" },
  ATXHeading2: { layer: "line", className: "md-heading md-h2" },
  ATXHeading3: { layer: "line", className: "md-heading md-h3" },
  ATXHeading4: { layer: "line", className: "md-heading md-h4" },
  ATXHeading5: { layer: "line", className: "md-heading md-h5" },
  ATXHeading6: { layer: "line", className: "md-heading md-h6" },
  // the title line only: `decorations.ts` gives the `===`/`---` underline its
  // own class, so it keeps normal metrics rather than a heading-sized box
  SetextHeading1: { layer: "line", className: "md-heading md-h1" },
  SetextHeading2: { layer: "line", className: "md-heading md-h2" },
  Blockquote: { layer: "line", className: "md-blockquote" },
  HorizontalRule: { layer: "line", className: "md-hr" },
  FencedCode: { layer: "line", className: "md-code-block" },
  Frontmatter: { layer: "line", className: "md-frontmatter" },

  EmphasisMark: { layer: "syntax", className: "md-syntax" },
  CodeMark: { layer: "syntax", className: "md-syntax" },
  HeaderMark: { layer: "syntax", className: "md-syntax" },
  StrikethroughMark: { layer: "syntax", className: "md-syntax" },
  TaskMarker: { layer: "syntax", className: "md-syntax" },
  ListMark: { layer: "syntax", className: "md-syntax" },
  LinkMark: { layer: "syntax", className: "md-syntax" },
  QuoteMark: { layer: "syntax", className: "md-syntax" },
  FrontmatterMark: { layer: "syntax", className: "md-syntax" },
  URL: { layer: "syntax", className: "md-url" },
};

export const nodeClassEntry = (nodeName: string): NodeClassEntry | undefined =>
  nodeClasses[nodeName];
