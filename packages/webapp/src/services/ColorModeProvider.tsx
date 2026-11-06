import {
  type ColorModePreference,
  ScopedTheme,
  useResolvedColorMode,
} from "alouette";
import type { ReactNode } from "react";
import { createContext, use, useMemo } from "react";
import { useStoredPreference } from "#/services/useStoredPreference.ts";

const storageKey = "reviewflow:color-mode";

const isColorModePreference = (value: string): value is ColorModePreference =>
  value === "light" || value === "dark" || value === "system";

interface ColorModeContextValue {
  preference: ColorModePreference;
  setPreference: (preference: ColorModePreference) => void;
}

const ColorModeContext = createContext<ColorModeContextValue | undefined>(
  undefined,
);

export const useColorModePreference = (): ColorModeContextValue => {
  const contextValue = use(ColorModeContext);
  if (!contextValue) throw new Error("Missing ColorModeProvider");
  return contextValue;
};

interface ColorModeProviderProps {
  children: ReactNode;
}

/**
 * Owns the light/dark choice: it applies it to the whole tree and persists it,
 * which is the app's job — `ColorModePicker` only reports the choice.
 */
export function ColorModeProvider({
  children,
}: ColorModeProviderProps): ReactNode {
  const [preference, setPreference] = useStoredPreference<ColorModePreference>(
    storageKey,
    isColorModePreference,
    "system",
  );

  const mode = useResolvedColorMode(preference);

  const contextValue = useMemo<ColorModeContextValue>(
    () => ({ preference, setPreference }),
    [preference, setPreference],
  );

  return (
    <ColorModeContext value={contextValue}>
      <ScopedTheme theme={mode}>{children}</ScopedTheme>
    </ColorModeContext>
  );
}
