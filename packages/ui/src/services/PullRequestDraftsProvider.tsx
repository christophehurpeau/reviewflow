import type { PullRequestRef } from "@reviewflow/sdk";
import type { ReactNode } from "react";
import {
  createContext,
  use,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

/**
 * Where what is being written on a pull request is kept between two visits.
 * Read synchronously, so an editor opens on its draft rather than flashing
 * empty: an app without synchronous storage passes none, and drafts then live
 * as long as the screen.
 */
export interface DraftStore {
  /** how long a draft is kept after its last change, told to the reader */
  retentionDays: number;
  /** undefined when nothing is kept under `key`, or it expired */
  read: (key: string) => unknown;
  write: (key: string, value: unknown) => void;
  remove: (key: string) => void;
}

/**
 * What every editor of the screen holds, blank and unchanged texts included,
 * outside the editors themselves: an editor remounted (its diff annotation
 * moved to another slot) opens on what was typed, and two editors of one key
 * (a thread's reply box in both tabs) show the same text.
 */
interface DraftMemory {
  get: (key: string) => string | undefined;
  set: (key: string, text: string) => void;
  delete: (key: string) => void;
  subscribe: (key: string, listener: () => void) => () => void;
}

const createDraftMemory = (): DraftMemory => {
  const texts = new Map<string, string>();
  const listeners = new Map<string, Set<() => void>>();
  const notify = (key: string): void => {
    for (const listener of listeners.get(key) ?? []) listener();
  };
  return {
    get: (key) => texts.get(key),
    set: (key, text) => {
      texts.set(key, text);
      notify(key);
    },
    delete: (key) => {
      if (texts.delete(key)) notify(key);
    },
    subscribe: (key, listener) => {
      const ofKey = listeners.get(key) ?? new Set();
      ofKey.add(listener);
      listeners.set(key, ofKey);
      return () => {
        ofKey.delete(listener);
      };
    },
  };
};

interface DraftsContextValue {
  /** the store, its keys scoped to the pull request of the provider */
  store: DraftStore | null;
  memory: DraftMemory;
}

const DraftsContext = createContext<DraftsContextValue | null>(null);

interface PullRequestDraftsProviderProps {
  store: DraftStore | undefined;
  pullRequest: PullRequestRef;
  children: ReactNode;
}

export function PullRequestDraftsProvider({
  store,
  pullRequest,
  children,
}: PullRequestDraftsProviderProps): ReactNode {
  const scope = `${pullRequest.ownerRepo}#${String(pullRequest.number)}`;
  const value = useMemo<DraftsContextValue>(
    () => ({
      store:
        store === undefined
          ? null
          : {
              retentionDays: store.retentionDays,
              read: (key) => store.read(`${scope}:${key}`),
              write: (key, text) => {
                store.write(`${scope}:${key}`, text);
              },
              remove: (key) => {
                store.remove(`${scope}:${key}`);
              },
            },
      memory: createDraftMemory(),
    }),
    [store, scope],
  );
  return <DraftsContext value={value}>{children}</DraftsContext>;
}

/** without a provider (a story), the editor keeps its own memory */
const useDraftsContext = (): DraftsContextValue => {
  const context = use(DraftsContext);
  // oxlint-disable-next-line react/hook-use-state -- created once, never set
  const [own] = useState((): DraftsContextValue => ({
    store: null,
    memory: createDraftMemory(),
  }));
  return context ?? own;
};

/** null when the app keeps no draft beyond the screen */
export const usePullRequestDrafts = (): DraftStore | null =>
  useDraftsContext().store;

const readKept = (
  { store, memory }: DraftsContextValue,
  key: string,
): string | undefined => {
  const held = memory.get(key);
  if (held !== undefined) return held;
  const stored = store?.read(key);
  return typeof stored === "string" ? stored : undefined;
};

/** Whether a text draft is kept under `key`, as of the mount. */
export const useHasDraftText = (key: string): boolean => {
  const context = useDraftsContext();
  // oxlint-disable-next-line react/hook-use-state -- read once, at mount, never set
  const [exists] = useState(() => readKept(context, key) !== undefined);
  return exists;
};

export interface DraftText {
  text: string;
  setText: (text: string) => void;
  /**
   * Back to `initial`, and forgets the kept draft: on cancel, or on send with
   * the text sent, kept instead when more was typed while it went out.
   */
  discard: (sent?: string) => void;
}

/**
 * The text of one editor, kept under `key` while it differs from `initial`
 * and is not blank. `initial` is read at each render: once discarded, the
 * editor shows the latest one.
 */
export const useDraftText = (key: string, initial = ""): DraftText => {
  const context = useDraftsContext();
  const { store, memory } = context;
  const kept = useSyncExternalStore(
    (listener) => memory.subscribe(key, listener),
    () => readKept(context, key),
  );

  return {
    text: kept ?? initial,
    setText: (next) => {
      memory.set(key, next);
      if (store === null) return;
      if (next === initial || next.trim() === "") store.remove(key);
      else store.write(key, next);
    },
    discard: (sent) => {
      if (sent !== undefined && (readKept(context, key) ?? initial) !== sent) {
        return;
      }
      memory.delete(key);
      store?.remove(key);
    },
  };
};
