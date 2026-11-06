import { type Density, DensityScope } from "alouette";
import type { ReactNode } from "react";
import { createContext, use, useMemo } from "react";
import { useStoredPreference } from "#/services/useStoredPreference.ts";

const storageKey = "reviewflow:density";

const isDensity = (value: string): value is Density =>
  value === "comfortable" || value === "compact";

interface DensityContextValue {
  density: Density;
  setDensity: (density: Density) => void;
}

const DensityPreferenceContext = createContext<DensityContextValue | undefined>(
  undefined,
);

export const useDensityPreference = (): DensityContextValue => {
  const contextValue = use(DensityPreferenceContext);
  if (!contextValue) throw new Error("Missing DensityProvider");
  return contextValue;
};

interface DensityProviderProps {
  children: ReactNode;
}

/**
 * Applies the control size chosen on this device. Comfortable by default:
 * compact controls are below the touch target, only the user knows they drive
 * the app with a mouse.
 */
export function DensityProvider({ children }: DensityProviderProps): ReactNode {
  const [density, setDensity] = useStoredPreference<Density>(
    storageKey,
    isDensity,
    "comfortable",
  );

  const contextValue = useMemo<DensityContextValue>(
    () => ({ density, setDensity }),
    [density, setDensity],
  );

  return (
    <DensityPreferenceContext value={contextValue}>
      <DensityScope density={density}>{children}</DensityScope>
    </DensityPreferenceContext>
  );
}
