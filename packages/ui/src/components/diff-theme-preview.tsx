import { parseDiffFromFile } from "@pierre/diffs";
import { FileDiff } from "@pierre/diffs/react";
import type { DiffFont, DiffTheme } from "@reviewflow/sdk";
import type { ReactNode } from "react";
import { diffFontCSS } from "./branch-diff/diff-font.ts";
import { diffThemeNames } from "./branch-diff/diff-themes.ts";

const before = `import { readFile } from "node:fs/promises";

/** Reads the settings, or null when there are none. */
export async function loadSettings(path: string) {
  const contents = await readFile(path, "utf8");
  return JSON.parse(contents);
}
`;

const after = `import { readFile } from "node:fs/promises";

const defaultTheme = "github";

/** Reads the settings, or the defaults when there are none. */
export async function loadSettings(path: string): Promise<Settings> {
  const contents = await readFile(path, "utf8").catch(() => "{}");
  return { theme: defaultTheme, ...JSON.parse(contents) };
}
`;

const sample = parseDiffFromFile(
  { name: "settings.ts", contents: before },
  { name: "settings.ts", contents: after },
);

interface DiffThemePreviewProps {
  theme: DiffTheme;
  font: DiffFont;
  themeType: "dark" | "light";
}

/**
 * A fixed diff rendered in the picked theme and font, in the app's current
 * mode. Its own lazy chunk, like the diff viewers: it carries shiki.
 */
export default function DiffThemePreview({
  theme,
  font,
  themeType,
}: DiffThemePreviewProps): ReactNode {
  return (
    <FileDiff
      fileDiff={sample}
      options={{
        diffStyle: "unified",
        theme: diffThemeNames(theme),
        themeType,
        overflow: "wrap",
        unsafeCSS: diffFontCSS(font),
      }}
    />
  );
}
