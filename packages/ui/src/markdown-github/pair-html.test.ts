import { describe, expect, it } from "vitest";
import { parseMarkdown } from "@tanstack/markdown/parser";
import { type GhBlockNode, isInlineNode, pairGithubHtml } from "./pair-html.ts";

const pair = (source: string) =>
  pairGithubHtml(parseMarkdown(source, { allowHtml: true }).children);

const first = (nodes: GhBlockNode[]): GhBlockNode =>
  nodes[0] ?? { type: "text", value: "" };

describe("pairGithubHtml", () => {
  it("pairs block tags across sibling nodes", () => {
    const { children } = pair(
      "<details>\n<summary>Click</summary>\n\nhello **b**\n\n</details>\n\nafter",
    );
    expect(children).toHaveLength(2);
    const details = first(children);
    expect(details).toMatchObject({ type: "element", tag: "details" });
    if (details.type !== "element") throw new Error("not an element");
    expect(details.children).toMatchObject([
      {
        type: "element",
        tag: "summary",
        children: [{ type: "text", value: "Click" }],
      },
      { type: "paragraph" },
    ]);
    expect(children[1]).toMatchObject({ type: "paragraph" });
  });

  it("keeps the open attribute", () => {
    const details = first(
      pair("<details open>\n<summary>x</summary>\n\nbody\n\n</details>")
        .children,
    );
    expect(details).toMatchObject({ tag: "details", attrs: { open: "" } });
  });

  it("pairs inline tags and treats void ones as closed", () => {
    const { children } = pair("a <sub>x</sub> b<br>c");
    const paragraph = first(children);
    if (paragraph.type !== "paragraph") throw new Error("not a paragraph");
    expect(paragraph.children).toMatchObject([
      { type: "text", value: "a " },
      { type: "element", tag: "sub", children: [{ type: "text", value: "x" }] },
      { type: "text", value: " b" },
      { type: "element", tag: "br", children: [] },
      { type: "text", value: "c" },
    ]);
  });

  it("closes an unclosed tag at the end of its parent", () => {
    const { children } = pair("> <sub>never closed\n\nafter");
    const quote = first(children);
    if (quote.type !== "blockquote") throw new Error("not a quote");
    expect(quote.children).toMatchObject([
      { type: "element", tag: "sub", children: [{ type: "text" }] },
    ]);
    expect(children[1]).toMatchObject({ type: "paragraph" });
  });

  it("ignores a stray close tag", () => {
    const { children } = pair("a</sub> b");
    const paragraph = first(children);
    if (paragraph.type !== "paragraph") throw new Error("not a paragraph");
    expect(paragraph.children.every((node) => node.type === "text")).toBe(true);
  });

  it("drops comments", () => {
    expect(pair("<!-- reviewflow-autoMerge -->").children).toEqual([]);
  });

  it("closes a tag with its match, taking the ones left open above it", () => {
    const { children } = pair("<div>\n<b>bold\n</div>\n\nafter");
    expect(first(children)).toMatchObject({
      tag: "div",
      children: [{ tag: "b" }],
    });
  });

  it("parses attributes and decodes entities", () => {
    const { children } = pair('<img src="a&amp;b.png" alt="x">');
    expect(first(children)).toMatchObject({
      tag: "img",
      attrs: { src: "a&b.png", alt: "x" },
    });
  });

  it("recurses into list items, quotes and emphasis", () => {
    const { children } = pair("- <b>x</b>\n- *a <sup>2</sup>*");
    const list = first(children);
    if (list.type !== "list") throw new Error("not a list");
    expect(JSON.stringify(list)).toContain('"tag":"sup"');
    expect(JSON.stringify(list)).toContain('"tag":"b"');
  });

  it("numbers task items in source order, nested ones after their parent", () => {
    const { children, taskCount } = pair(
      "- [ ] a\n  - [x] b\n- plain\n- [ ] c\n\n<details>\n\n- [ ] d\n\n</details>",
    );
    expect(taskCount).toBe(4);
    const list = first(children);
    if (list.type !== "list") throw new Error("not a list");
    expect(list.items.map((item) => item.taskIndex)).toEqual([0, undefined, 2]);
    const nested = list.items[0]?.children.find((node) => node.type === "list");
    expect(nested).toMatchObject({ items: [{ taskIndex: 1 }] });
    expect(JSON.stringify(children[1])).toContain('"taskIndex":3');
  });

  it("tells inline nodes from blocks", () => {
    const { children } = pair("<div>y</div>");
    expect(children.map(isInlineNode)).toEqual([false]);
    const sub = pair("a <sub>x</sub>").children[0];
    if (sub?.type !== "paragraph") throw new Error("not a paragraph");
    expect(sub.children.map(isInlineNode)).toEqual([true, true]);
  });

  it("decodes entities in markdown text but not in code", () => {
    const paragraph = first(pair("a &amp; b `&amp;` AT&T").children);
    if (paragraph.type !== "paragraph") throw new Error("not a paragraph");
    expect(paragraph.children).toMatchObject([
      { type: "text", value: "a & b " },
      { type: "inlineCode", value: "&amp;" },
      { type: "text", value: " AT&T" },
    ]);
  });

  it("keeps whitespace in pre", () => {
    const { children } = pair("<pre>\na   b\n</pre>");
    expect(JSON.stringify(first(children))).toContain("a   b");
  });

  it("keeps the markdown after a leading comment and drops the comment", () => {
    const { children } = pair("<!-- id -->**bold** and `code`");
    expect(children).toMatchObject([
      {
        type: "paragraph",
        children: [
          { type: "strong" },
          { type: "text" },
          { type: "inlineCode" },
        ],
      },
    ]);
  });

  it("still pairs a tag that follows a leading comment", () => {
    const { children } = pair("<!-- c --><details>\n\nbody\n\n</details>");
    expect(children).toMatchObject([{ type: "element", tag: "details" }]);
  });
});
