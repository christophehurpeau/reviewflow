import { yamlLanguage } from "@codemirror/lang-yaml";
import { parseMixed } from "@lezer/common";
import type {
  BlockContext,
  Element,
  Line,
  MarkdownConfig,
} from "@lezer/markdown";

/**
 * A leading `---` … `---` block, parsed as yaml. **Every template starts with
 * one.** Without this, the opening `---` is a horizontal rule, the yaml below
 * it becomes the title of a setext heading closed by the second `---`, and the
 * whole block renders as one H2.
 *
 * Strict on purpose: at position 0 only, three dashes exactly, and the line
 * after the opening fence must not be blank. A block parser cannot look further
 * ahead than one line nor give a line back, so a block missing its closing
 * fence runs to the end of the document; the blank-line rule keeps a document
 * that opens on a horizontal rule from being swallowed that way.
 *
 * Ported from vscode-extension-markdown-beautiful-editor
 * (`src/webview/cm/lang/frontmatter.ts`).
 */
const isFence = (text: string): boolean => /^---[ \t]*$/u.test(text);

const parseFrontmatter = (cx: BlockContext, line: Line): boolean => {
  if (
    cx.lineStart !== 0 ||
    line.pos !== 0 ||
    !isFence(line.text) ||
    cx.peekLine().trim() === ""
  ) {
    return false;
  }

  const from = cx.lineStart;
  const openMark = cx.elt("FrontmatterMark", from, from + line.text.length);
  const contentFrom = from + line.text.length + 1;
  let contentTo = contentFrom;
  let closeMark: Element | null = null;
  let to = from + line.text.length;

  while (cx.nextLine()) {
    const lineEnd = cx.lineStart + line.text.length;
    to = lineEnd;
    if (isFence(line.text)) {
      closeMark = cx.elt("FrontmatterMark", cx.lineStart, lineEnd);
      cx.nextLine();
      break;
    }
    contentTo = lineEnd;
  }

  const children = [openMark];
  if (contentTo > contentFrom) {
    children.push(cx.elt("FrontmatterContent", contentFrom, contentTo));
  }
  if (closeMark !== null) children.push(closeMark);
  cx.addElement(cx.elt("Frontmatter", from, to, children));
  return true;
};

export const frontmatter: MarkdownConfig = {
  defineNodes: [
    { name: "Frontmatter", block: true },
    "FrontmatterMark",
    "FrontmatterContent",
  ],
  parseBlock: [
    { name: "Frontmatter", before: "HorizontalRule", parse: parseFrontmatter },
  ],
  wrap: parseMixed((node) =>
    node.name === "FrontmatterContent" ? { parser: yamlLanguage.parser } : null,
  ),
};
