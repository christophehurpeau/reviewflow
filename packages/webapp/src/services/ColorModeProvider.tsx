import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  type ColorModePreference,
  ScopedTheme,
  useResolvedColorMode,
} from "alouette";
import type { ReactNode } from "react";
import { createContext, use, useEffect, useMemo, useState } from "react";

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
 * which is the app's job — `ColorModePicker` only reports the choice. Nothing
 * can be read synchronously on native, so the first paint follows the system
 * and the stored preference lands right after.
 */
export function ColorModeProvider({
  children,
}: ColorModeProviderProps): ReactNode {
  const [preference, setPreference] = useState<ColorModePreference>("system");

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(storageKey).then((stored) => {
      if (!cancelled && stored !== null && isColorModePreference(stored)) {
        setPreference(stored);
      }
    }, console.error);

    return () => {
      cancelled = true;
    };
  }, []);

  const mode = useResolvedColorMode(preference);

  const contextValue = useMemo<ColorModeContextValue>(
    () => ({
      preference,
      setPreference: (nextPreference) => {
        setPreference(nextPreference);
        AsyncStorage.setItem(storageKey, nextPreference).catch(console.error);
      },
    }),
    [preference],
  );

  return (
    <ColorModeContext value={contextValue}>
      <ScopedTheme theme={mode}>{children}</ScopedTheme>
    </ColorModeContext>
  );
}
