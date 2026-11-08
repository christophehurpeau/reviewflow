import { type ColorModePreference, ScopedTheme } from "alouette";
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
 * which is the app's job — `ColorModePicker` only reports the choice. The
 * preference goes to `ScopedTheme` as is: `system` is resolved by the palette
 * CSS (`prefers-color-scheme`), so the prerendered HTML wears the visitor's mode
 * instead of flashing light until hydration.
 */
export function ColorModeProvider({
  children,
}: ColorModeProviderProps): ReactNode {
  const [preference, setPreference] = useStoredPreference<ColorModePreference>(
    storageKey,
    isColorModePreference,
    "system",
  );

  const contextValue = useMemo<ColorModeContextValue>(
    () => ({ preference, setPreference }),
    [preference, setPreference],
  );

  return (
    <ColorModeContext value={contextValue}>
      <ScopedTheme theme={preference}>{children}</ScopedTheme>
    </ColorModeContext>
  );
}
