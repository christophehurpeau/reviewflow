import { describe, expect, it } from "vitest";
import { parseMarkdown } from "@tanstack/markdown/parser";
import { collectImages, isImageRun, textOf } from "./flatten.ts";
import { pairGithubHtml } from "./pair-html.ts";

const pair = (source: string) =>
  pairGithubHtml(parseMarkdown(source, { allowHtml: true }).children).children;

describe("textOf", () => {
  it("flattens inline markup, br and entities", () => {
    expect(textOf(pair("a **b** <i>c</i><br>d &amp; e"))).toBe("a b c\nd & e");
  });

  it("keeps the whitespace of a pre", () => {
    expect(textOf(pair("<pre>\na   b\n</pre>"))).toContain("a   b");
  });
});

describe("collectImages", () => {
  it("finds markdown images, img tags and a picture's img through a link", () => {
    const nodes = pair(
      '![one](a.png) <a href="x"><img src="b.png" alt="two"></a>\n\n<picture><source srcset="c.png"><img src="d.png"></picture>',
    );
    expect(collectImages(nodes)).toEqual([
      { src: "a.png", alt: "one" },
      { src: "b.png", alt: "two" },
      { src: "d.png", alt: "" },
    ]);
  });

  it("skips an img without src", () => {
    expect(collectImages(pair("<img alt=x>"))).toEqual([]);
  });
});

describe("isImageRun", () => {
  it("is true for badges, linked or not, and false once text is mixed in", () => {
    const paragraph = pair("![a](a.png) [![b](b.png)](https://x.y)")[0];
    if (paragraph?.type !== "paragraph") throw new Error("not a paragraph");
    expect(isImageRun(paragraph.children)).toBe(true);
    const mixed = pair("see ![a](a.png)")[0];
    if (mixed?.type !== "paragraph") throw new Error("not a paragraph");
    expect(isImageRun(mixed.children)).toBe(false);
  });
});
