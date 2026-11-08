/**
 * GitHub serves the images of a body through camo, its image proxy, so the
 * host of an image a stranger put in a pull request never learns who read it
 * nor when. A camo url is signed with GitHub's key: it cannot be built, only
 * read from the html GitHub renders (`bodyHTML`), where each proxied `<img>`
 * keeps the url the markdown wrote in `data-canonical-src`.
 */

const imgTag = /<img\b[^>]*>/gi;

const decodeAttribute = (value: string): string =>
  value
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");

const attribute = (tag: string, name: string): string | null => {
  const match = new RegExp(`\\s${name}="([^"]*)"`, "i").exec(tag);
  return match?.[1] === undefined ? null : decodeAttribute(match[1]);
};

/** The url each image of `html` was written with, to the one GitHub serves it from. */
export const imageProxiesOf = (
  html: string | null | undefined,
): Record<string, string> => {
  const proxies: Record<string, string> = {};
  for (const [tag] of (html ?? "").matchAll(imgTag)) {
    const src = attribute(tag, "src");
    const canonical = attribute(tag, "data-canonical-src");
    if (src !== null && canonical !== null && src !== canonical) {
      proxies[canonical] = src;
    }
  }
  return proxies;
};

/** Every body's proxies of one part, merged. */
export const mergeImageProxies = (
  htmls: readonly (string | null | undefined)[],
): Record<string, string> =>
  Object.assign({}, ...htmls.map(imageProxiesOf)) as Record<string, string>;
