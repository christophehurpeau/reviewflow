import type { GhBlockNode } from "./pair-html.ts";

/** The text of a run, as a link label or a `<pre>`'s source. */
export function textOf(nodes: GhBlockNode[]): string {
  return nodes
    .map((node): string => {
      if (node.type === "text" || node.type === "inlineCode") return node.value;
      if (node.type === "image") return node.alt;
      if (node.type === "break") return "\n";
      if (node.type === "element") {
        if (node.tag === "br") return "\n";
        if (node.tag === "img") return node.attrs.alt ?? "";
      }
      return "children" in node ? textOf(node.children) : "";
    })
    .join("");
}

export interface GhImage {
  src: string;
  alt: string;
}

/** Every image in a run, through links and `<picture>`. */
export const collectImages = (nodes: GhBlockNode[]): GhImage[] =>
  nodes.flatMap((node): GhImage[] => {
    if (node.type === "image") return [{ src: node.src, alt: node.alt }];
    if (node.type === "element" && node.tag === "img") {
      const src = node.attrs.src;
      return src ? [{ src, alt: node.attrs.alt ?? "" }] : [];
    }
    if ("children" in node) return collectImages(node.children);
    return [];
  });

const isImageOnly = (node: GhBlockNode): boolean => {
  if (node.type === "image" || node.type === "break") return true;
  if (node.type === "text") return node.value.trim() === "";
  if (node.type === "link") return node.children.every(isImageOnly);
  if (node.type === "element") {
    if (["br", "img", "picture"].includes(node.tag)) return true;
    return node.tag === "a" && node.children.every(isImageOnly);
  }
  return false;
};

/** A run of badges and pictures: laid out as a row rather than as text. */
export const isImageRun = (nodes: GhBlockNode[]): boolean =>
  collectImages(nodes).length > 0 && nodes.every(isImageOnly);
