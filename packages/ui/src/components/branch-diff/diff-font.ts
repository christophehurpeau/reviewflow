import type { DiffFont } from "@reviewflow/sdk";

const alouetteMono = "var(--font-mono)";

/** What would end the declaration, the rule or the style, or open a comment. */
const outsideAFontFamily = /[\n\r*/;<>\\{}]/g;

/**
 * The CSS `font-family` of the diff's code; null keeps pierre's own. A custom
 * one falls back to alouette's mono, for a font this machine does not have.
 * alouette's `--font-mono` is declared on the document root, which pierre's
 * shadow root inherits.
 */
export const diffFontFamily = (
  font: DiffFont,
  customFont: string,
): string | null => {
  if (font === "pierre") return null;
  const custom = customFont.replaceAll(outsideAFontFamily, "").trim();
  if (font === "custom" && custom !== "") return `${custom}, ${alouetteMono}`;
  return alouetteMono;
};

/** For a pierre file's `unsafeCSS`: its code in `fontFamily`. */
export const diffFontCSS = (fontFamily: string | null): string =>
  fontFamily === null ? "" : `:host { --diffs-font-family: ${fontFamily}; }`;
