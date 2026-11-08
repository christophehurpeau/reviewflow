import type { DiffFont } from "@reviewflow/sdk";

/**
 * For a pierre file's `unsafeCSS`: its code in the picked font. alouette's
 * `--font-mono` is declared on the document root, which the shadow root
 * inherits; `pierre` keeps the system mono stack pierre falls back to.
 */
export const diffFontCSS = (font: DiffFont): string =>
  font === "alouette" ? ":host { --diffs-font-family: var(--font-mono); }" : "";
