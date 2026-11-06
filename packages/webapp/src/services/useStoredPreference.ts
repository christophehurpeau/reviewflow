import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

/**
 * A device-level preference persisted in AsyncStorage. Nothing can be read
 * synchronously on native, so the first paint uses `defaultValue` and the
 * stored value lands right after.
 */
export const useStoredPreference = <T extends string>(
  storageKey: string,
  isPreference: (value: string) => value is T,
  defaultValue: T,
): [T, (preference: T) => void] => {
  const [preference, setPreference] = useState<T>(defaultValue);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(storageKey).then((stored) => {
      if (!cancelled && stored !== null && isPreference(stored)) {
        setPreference(stored);
      }
    }, console.error);

    return () => {
      cancelled = true;
    };
  }, [storageKey, isPreference]);

  const storePreference = useCallback(
    (nextPreference: T): void => {
      setPreference(nextPreference);
      AsyncStorage.setItem(storageKey, nextPreference).catch(console.error);
    },
    [storageKey],
  );

  return [preference, storePreference];
};
