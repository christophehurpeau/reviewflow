import { animationDurationsMs } from "alouette";
import type { RefObject } from "react";
import {
  createContext,
  use,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";

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
  /** the file whose element spans the viewport's `y`; null in a gap or past the files */
  fileAt: (y: number) => string | null;
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
    fileAt: (y) => {
      for (const [path, element] of elements) {
        const { top, bottom } = element.getBoundingClientRect();
        if (top <= y && y < bottom) return path;
      }
      return null;
    },
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

/**
 * The file read at the moment: the one under the bottom edge of `bar`, the
 * sticky toolbar the diff scrolls beneath. Measured once a frame while
 * anything scrolls, on the web only; it keeps the last file found while the
 * edge is over a gap between files, and is null until one is.
 */
export const useFileInView = (
  fileElements: DiffFileElements,
  bar: RefObject<unknown>,
  enabled: boolean,
): string | null => {
  const [path, setPath] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled || typeof document === "undefined") return undefined;
    let frame: number | null = null;
    const measure = (): void => {
      frame = null;
      const element = bar.current;
      if (!(element instanceof HTMLElement)) return;
      const found = fileElements.fileAt(
        element.getBoundingClientRect().bottom + 1,
      );
      if (found !== null) setPath(found);
    };
    const schedule = (): void => {
      frame ??= requestAnimationFrame(measure);
    };
    schedule();
    document.addEventListener("scroll", schedule, {
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      document.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
    };
  }, [fileElements, bar, enabled]);
  return enabled ? path : null;
};

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
