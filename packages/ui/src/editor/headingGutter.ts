import { syntaxTree } from "@codemirror/language";
import type { EditorState, Extension, RangeSet } from "@codemirror/state";
import { RangeSetBuilder, StateField } from "@codemirror/state";
import { GutterMarker, gutterLineClass } from "@codemirror/view";

/**
 * A heading line is taller than a paragraph and padded above (`.md-h1` and
 * the others in `markdown-editor.css`), while a gutter element draws its
 * number at the top of the line's box: the number would float above the
 * title. Each heading's gutter element takes a class of its level, which
 * gives it the same padding and line height as its line.
 */
class HeadingGutterClass extends GutterMarker {
  readonly level: number;

  constructor(level: number) {
    super();
    this.level = level;
    this.elementClass = `md-gutter-h${String(level)}`;
  }

  override eq(other: GutterMarker): boolean {
    return other instanceof HeadingGutterClass && other.level === this.level;
  }
}

const markers = [1, 2, 3, 4, 5, 6].map(
  (level) => new HeadingGutterClass(level),
);

const levelOf = (name: string): number | null => {
  const match = /^(?:ATX|Setext)Heading([1-6])$/.exec(name);
  return match === null ? null : Number(match[1]);
};

/**
 * Only the document's own blocks are visited, never the inline nodes: a
 * heading nested in a quote or a list keeps an unaligned number, the price of
 * not walking a large file's whole tree on every keystroke.
 */
const headingClassesOf = (state: EditorState): RangeSet<GutterMarker> => {
  const builder = new RangeSetBuilder<GutterMarker>();
  for (
    let block = syntaxTree(state).topNode.firstChild;
    block !== null;
    block = block.nextSibling
  ) {
    const level = levelOf(block.name);
    if (level !== null) {
      const { from } = state.doc.lineAt(block.from);
      builder.add(from, from, markers[level - 1]!);
    }
  }
  return builder.finish();
};

const headingGutterField = StateField.define<RangeSet<GutterMarker>>({
  create: headingClassesOf,
  update: (classes, transaction) =>
    // the parser finishing in the background changes the tree without a doc change
    syntaxTree(transaction.startState) === syntaxTree(transaction.state)
      ? classes
      : headingClassesOf(transaction.state),
});

export const headingGutter: Extension = [
  headingGutterField,
  gutterLineClass.from(headingGutterField),
];
