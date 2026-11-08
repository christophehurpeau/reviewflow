import type { DiffFont, DiffWhitespace } from "@reviewflow/sdk";
import { defaultDiffFont, defaultDiffTheme } from "@reviewflow/sdk";
import type { ReactNode } from "react";
import { createContext, use, useMemo, useState } from "react";
import { diffFontFamily } from "./diff-font.ts";
import type { DiffTheme } from "./diff-themes.ts";

/**
 * `packages`: by package, in patch order. `reading` (experimental): packages
 * from the one depending on the others down, files from their entry points
 * down, tests and stories closed below the file they cover.
 */
export type DiffFileOrder = "packages" | "reading";

export const isDiffFileOrder = (value: string): value is DiffFileOrder =>
  value === "packages" || value === "reading";

export interface DiffSettings {
  wordWrap: boolean;
  theme: DiffTheme;
  /** the code's CSS `font-family`; null keeps pierre's own */
  fontFamily: string | null;
  whitespace: DiffWhitespace;
  setWhitespace: (whitespace: DiffWhitespace) => void;
  fileOrder: DiffFileOrder;
  setFileOrder: (fileOrder: DiffFileOrder) => void;
}

const defaults: DiffSettings = {
  wordWrap: true,
  theme: defaultDiffTheme,
  fontFamily: diffFontFamily(defaultDiffFont, ""),
  whitespace: "show",
  setWhitespace: () => undefined,
  fileOrder: "packages",
  setFileOrder: () => undefined,
};

const DiffSettingsContext = createContext<DiffSettings>(defaults);

interface DiffSettingsProviderProps {
  theme?: DiffTheme;
  font?: DiffFont;
  /** the CSS `font-family` of the `custom` font */
  customFont?: string;
  wordWrap?: boolean;
  /** the whitespace the diff starts with; the toolbar toggle then owns it */
  initialWhitespace?: DiffWhitespace;
  /** the order an app stored; absent, the toolbar toggle owns it for the screen's life */
  fileOrder?: DiffFileOrder;
  /** called by the toolbar toggle, for an app that stores the order */
  onFileOrderChange?: (fileOrder: DiffFileOrder) => void;
  children: ReactNode;
}

/**
 * The diff's display settings. `hide` is `git diff -w`, so it is part of the
 * diff's range and the toolbar toggle writes it here. Held in memory: an app
 * that stores them passes the initial values it loaded.
 */
export function DiffSettingsProvider({
  theme = defaults.theme,
  font = defaultDiffFont,
  customFont = "",
  wordWrap = defaults.wordWrap,
  initialWhitespace = defaults.whitespace,
  fileOrder: storedFileOrder,
  onFileOrderChange,
  children,
}: DiffSettingsProviderProps): ReactNode {
  const [whitespace, setWhitespace] = useState(initialWhitespace);
  const [ownFileOrder, setOwnFileOrder] = useState(defaults.fileOrder);
  const fileOrder = storedFileOrder ?? ownFileOrder;
  const fontFamily = diffFontFamily(font, customFont);
  const value = useMemo(
    () => ({
      theme,
      fontFamily,
      wordWrap,
      whitespace,
      setWhitespace,
      fileOrder,
      setFileOrder: (next: DiffFileOrder) => {
        setOwnFileOrder(next);
        onFileOrderChange?.(next);
      },
    }),
    [theme, fontFamily, wordWrap, whitespace, fileOrder, onFileOrderChange],
  );
  return <DiffSettingsContext value={value}>{children}</DiffSettingsContext>;
}

export const useDiffSettings = (): DiffSettings => use(DiffSettingsContext);

interface WhitespaceToggle {
  whitespace: DiffWhitespace;
  toggle: () => void;
}

/** The diff toolbar's switch between hiding and showing whitespace changes. */
export const useWhitespaceToggle = (): WhitespaceToggle => {
  const { whitespace, setWhitespace } = useDiffSettings();
  return {
    whitespace,
    toggle: () => {
      setWhitespace(whitespace === "show" ? "hide" : "show");
    },
  };
};
