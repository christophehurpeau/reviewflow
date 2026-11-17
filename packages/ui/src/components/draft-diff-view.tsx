import { parseDiffFromFile } from "@pierre/diffs";
import { FileDiff } from "@pierre/diffs/react";
import type { DiffTheme } from "@reviewflow/sdk";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { diffFontCSS } from "./branch-diff/diff-font.ts";
import {
  changeBackgroundCSS,
  diffThemeNames,
} from "./branch-diff/diff-themes.ts";

export interface DraftDiffViewProps {
  path: string;
  /** the file as `HEAD` has it; empty for a file `HEAD` does not have */
  original: string;
  /** the editor's draft, saved or not */
  current: string;
  theme: DiffTheme;
  fontFamily: string | null;
  themeType: "dark" | "light";
  wordWrap: boolean;
}

/**
 * One file's diff computed in the page from two texts, `HEAD`'s and the
 * draft's, rather than read from git: what is typed shows before it is saved.
 * Drawn as the diff tabs draw theirs (theme, font, change backgrounds), in
 * unified style. Its own lazy chunk, like the diff viewers: it carries shiki.
 */
export default function DraftDiffView({
  path,
  original,
  current,
  theme,
  fontFamily,
  themeType,
  wordWrap,
}: DraftDiffViewProps): ReactNode {
  const fileDiff = useMemo(
    () =>
      parseDiffFromFile(
        { name: path, contents: original },
        { name: path, contents: current },
      ),
    [path, original, current],
  );
  return (
    <FileDiff
      fileDiff={fileDiff}
      options={{
        diffStyle: "unified",
        theme: diffThemeNames(theme),
        themeType,
        overflow: wordWrap ? "wrap" : "scroll",
        unsafeCSS: `${diffFontCSS(fontFamily)} ${changeBackgroundCSS(theme)}`,
      }}
    />
  );
}
