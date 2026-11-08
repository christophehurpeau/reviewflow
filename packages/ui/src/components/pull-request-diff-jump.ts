import { animationDurationsMs } from "alouette";
import { createContext, use, useSyncExternalStore } from "react";

/** How long a file gone to stays outlined before the outline fades. */
const highlightHoldMs = 1500;

export interface DiffFileHighlight {
  /** `shown` then `fading`, then no highlight at all */
  phase: "fading" | "shown";
  /** a CSS color, read from the theme when the file was gone to */
  color: string;
}

/**
 * The rendered files of a diff by path, so a link elsewhere on the screen (the
 * overview) can bring one into view and outline it a moment, to show which
 * one it is. The viewer registers its files; the diff view owns the registry.
 */
export interface DiffFileElements {
  /** returns the unregistration */
  register: (path: string, element: HTMLElement) => () => void;
  elementOf: (path: string) => HTMLElement | undefined;
  /** outlines the file's header in `color`, replacing any outline still showing */
  highlight: (path: string, color: string) => void;
  subscribe: (listener: () => void) => () => void;
  highlightOf: (path: string) => DiffFileHighlight | null;
}

export const createDiffFileElements = (): DiffFileElements => {
  const elements = new Map<string, HTMLElement>();
  const listeners = new Set<() => void>();
  let highlighted: (DiffFileHighlight & { path: string }) | null = null;
  let timers: ReturnType<typeof setTimeout>[] = [];
  const setHighlighted = (next: typeof highlighted): void => {
    highlighted = next;
    for (const listener of listeners) listener();
  };
  return {
    register: (path, element) => {
      elements.set(path, element);
      return () => {
        if (elements.get(path) === element) elements.delete(path);
      };
    },
    elementOf: (path) => elements.get(path),
    highlight: (path, color) => {
      for (const timer of timers) clearTimeout(timer);
      setHighlighted({ path, phase: "shown", color });
      timers = [
        setTimeout(() => {
          setHighlighted({ path, phase: "fading", color });
        }, highlightHoldMs),
        setTimeout(() => {
          setHighlighted(null);
        }, highlightHoldMs + animationDurationsMs.collapse),
      ];
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    // the same object until it changes, as useSyncExternalStore needs
    highlightOf: (path) => (highlighted?.path === path ? highlighted : null),
  };
};

export const DiffFileElementsContext = createContext<DiffFileElements | null>(
  null,
);

export const useDiffFileElements = (): DiffFileElements | null =>
  use(DiffFileElementsContext);

const noSubscription = (): (() => void) => () => {};

/** Re-renders only the file whose highlight changes, not every file of the diff. */
export const useDiffFileHighlight = (
  path: string,
): DiffFileHighlight | null => {
  const fileElements = useDiffFileElements();
  return useSyncExternalStore(
    fileElements?.subscribe ?? noSubscription,
    () => fileElements?.highlightOf(path) ?? null,
  );
};
