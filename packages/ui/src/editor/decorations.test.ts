import { describe, expect, it } from "vitest";
import { ensureSyntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import type { DecorationSet } from "@codemirror/view";
import { buildMarkdownDecorations } from "./decorations.ts";
import { markdownLanguage } from "./extensions.ts";

/**
 * Decorations are asserted as `{text, class}` over a plain `EditorState`: no
 * view and no DOM, so what is checked is which characters carry which class,
 * not how they render.
 */
const decorate = (doc: string) => {
  const state = EditorState.create({ doc, extensions: [markdownLanguage()] });
  ensureSyntaxTree(state, state.doc.length, 5000);
  const sets = buildMarkdownDecorations(state, [{ from: 0, to: doc.length }]);

  const spans = (set: DecorationSet): { text: string; class: string }[] => {
    const found: { text: string; class: string }[] = [];
    set.between(0, doc.length, (from, to, value) => {
      found.push({
        text: state.doc.sliceString(from, to),
        class: String(value.spec.class),
      });
    });
    return found;
  };

  const lines: { line: string; class: string }[] = [];
  sets.lines.between(0, doc.length, (from, _to, value) => {
    lines.push({
      line: state.doc.lineAt(from).text,
      class: String(value.spec.class),
    });
  });

  return { marks: spans(sets.marks), syntax: spans(sets.syntax), lines };
};

describe("buildMarkdownDecorations", () => {
  it("marks emphasis and mutes its delimiters", () => {
    const { marks, syntax } = decorate("a **bold** and *it*\n");

    expect(marks).toEqual(
      expect.arrayContaining([
        { text: "**bold**", class: "md-bold" },
        { text: "*it*", class: "md-italic" },
      ]),
    );
    expect(syntax.filter((span) => span.class === "md-syntax")).toHaveLength(4);
  });

  it("puts a heading's class on its line, the # muted", () => {
    const { lines, syntax } = decorate("## Title\n\ntext\n");

    expect(lines).toEqual([{ line: "## Title", class: "md-heading md-h2" }]);
    expect(syntax).toContainEqual({ text: "##", class: "md-syntax" });
  });

  it("reads a leading --- block as frontmatter, not a rule over an H2", () => {
    const { lines } = decorate(
      "---\nname: Spec\nrepos: [a/b]\n---\n/spec {TICKET_URL}\n",
    );

    expect(lines.map((line) => line.line)).toEqual([
      "---",
      "name: Spec",
      "repos: [a/b]",
      "---",
    ]);
    expect(lines[0]?.class).toContain("md-frontmatter-first");
    expect(lines[3]?.class).toContain("md-frontmatter-last");
    expect(lines.some((line) => line.class.includes("md-heading"))).toBe(false);
  });

  it("aligns table cells from the delimiter row", () => {
    const { marks } = decorate("| a | b |\n|:--|--:|\n| 1 | 2 |\n");

    const cells = marks.filter((span) =>
      span.class.startsWith("md-table-cell"),
    );
    expect(cells).toContainEqual({
      text: "a",
      class: "md-table-cell md-col-left",
    });
    expect(cells).toContainEqual({
      text: "2",
      class: "md-table-cell md-col-right",
    });
  });

  it("styles a GitHub alert from its blockquote's first line", () => {
    const { lines, marks } = decorate("> [!WARNING]\n> careful\n");

    expect(lines[0]?.class).toContain("md-alert-warning");
    expect(lines[1]?.class).toContain("md-alert-content");
    expect(marks).toContainEqual({ text: "WARNING", class: "md-alert-type" });
  });

  it("leaves an empty image without a mark rather than throwing", () => {
    expect(() => decorate("![](x.png)\n")).not.toThrow();
  });
});
