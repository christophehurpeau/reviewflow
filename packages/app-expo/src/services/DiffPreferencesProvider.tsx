import type { DiffFont, DiffTheme } from "@reviewflow/sdk";
import {
  defaultDiffFont,
  defaultDiffTheme,
  isDiffFont,
  isDiffTheme,
} from "@reviewflow/sdk";
import type { DiffDisplaySettings } from "@reviewflow/ui";
import type { ReactNode } from "react";
import { createContext, use, useMemo } from "react";
import { useStoredPreference } from "#/services/useStoredPreference.ts";

type Toggle = "off" | "on";

const isToggle = (value: string): value is Toggle =>
  value === "on" || value === "off";

/** Any text: `diffFontFamily` keeps what can stand in a CSS declaration. */
const isFontFamily = (value: string): value is string =>
  typeof value === "string";

interface DiffPreferences {
  settings: DiffDisplaySettings;
  /** every preference has been read from storage, or failed to be */
  loaded: boolean;
  change: (change: Partial<DiffDisplaySettings>) => Promise<void>;
}

const DiffPreferencesContext = createContext<DiffPreferences | undefined>(
  undefined,
);

export const useDiffPreferences = (): DiffPreferences => {
  const contextValue = use(DiffPreferencesContext);
  if (!contextValue) throw new Error("Missing DiffPreferencesProvider");
  return contextValue;
};

interface DiffPreferencesProviderProps {
  children: ReactNode;
}

/** How the diffs render, chosen on this device in Settings. */
export function DiffPreferencesProvider({
  children,
}: DiffPreferencesProviderProps): ReactNode {
  const [wordWrap, setWordWrap, wordWrapLoaded] = useStoredPreference<Toggle>(
    "reviewflow:diff-word-wrap",
    isToggle,
    "on",
  );
  const [hideWhitespace, setHideWhitespace, hideWhitespaceLoaded] =
    useStoredPreference<Toggle>(
      "reviewflow:diff-hide-whitespace",
      isToggle,
      "off",
    );
  const [theme, setTheme, themeLoaded] = useStoredPreference<DiffTheme>(
    "reviewflow:diff-theme",
    isDiffTheme,
    defaultDiffTheme,
  );
  const [font, setFont, fontLoaded] = useStoredPreference<DiffFont>(
    "reviewflow:diff-font",
    isDiffFont,
    defaultDiffFont,
  );
  const [customFont, setCustomFont, customFontLoaded] =
    useStoredPreference<string>(
      "reviewflow:diff-custom-font",
      isFontFamily,
      "",
    );

  const contextValue = useMemo<DiffPreferences>(
    () => ({
      settings: {
        wordWrap: wordWrap === "on",
        hideWhitespace: hideWhitespace === "on",
        theme,
        font,
        customFont,
      },
      loaded:
        wordWrapLoaded &&
        hideWhitespaceLoaded &&
        themeLoaded &&
        fontLoaded &&
        customFontLoaded,
      change: (change) => {
        if (change.wordWrap !== undefined) {
          setWordWrap(change.wordWrap ? "on" : "off");
        }
        if (change.hideWhitespace !== undefined) {
          setHideWhitespace(change.hideWhitespace ? "on" : "off");
        }
        if (change.theme !== undefined) setTheme(change.theme);
        if (change.font !== undefined) setFont(change.font);
        if (change.customFont !== undefined) setCustomFont(change.customFont);
        return Promise.resolve();
      },
    }),
    [
      wordWrap,
      hideWhitespace,
      theme,
      font,
      customFont,
      wordWrapLoaded,
      hideWhitespaceLoaded,
      themeLoaded,
      fontLoaded,
      customFontLoaded,
      setWordWrap,
      setHideWhitespace,
      setTheme,
      setFont,
      setCustomFont,
    ],
  );

  return (
    <DiffPreferencesContext value={contextValue}>
      {children}
    </DiffPreferencesContext>
  );
}
