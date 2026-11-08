import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

/**
 * A device-level preference persisted in AsyncStorage. Nothing can be read
 * synchronously on native, so the first paint uses `defaultValue` and the
 * stored value lands right after; `loaded` says it has, or that the read
 * failed, for a consumer that reads the value only once.
 */
export const useStoredPreference = <T extends string>(
  storageKey: string,
  isPreference: (value: string) => value is T,
  defaultValue: T,
): [T, (preference: T) => void, boolean] => {
  const [preference, setPreference] = useState<T>(defaultValue);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(storageKey)
      .then((stored) => {
        if (!cancelled && stored !== null && isPreference(stored)) {
          setPreference(stored);
        }
      }, console.error)
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });

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

  return [preference, storePreference, loaded];
};
