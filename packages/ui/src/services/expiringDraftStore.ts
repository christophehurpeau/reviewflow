import type { DraftStore } from "./PullRequestDraftsProvider.tsx";

/** The part of the web `Storage` the store needs, so a test can pass a map. */
export interface DraftStorage {
  readonly length: number;
  key: (index: number) => string | null;
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

interface StoredDraft {
  savedAt: number;
  value: unknown;
}

const prefix = "reviewflow:draft:";
const dayMs = 24 * 60 * 60 * 1000;

const parse = (raw: string | null): StoredDraft | null => {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as StoredDraft).savedAt === "number"
      ? (parsed as StoredDraft)
      : null;
  } catch {
    return null;
  }
};

export interface ExpiringDraftStoreOptions {
  storage: DraftStorage;
  retentionDays: number;
  now?: () => number;
}

/**
 * A {@link DraftStore} over a synchronous key-value storage, each draft
 * dropped `retentionDays` after its last write. Expired drafts are swept when
 * the store is created, so a pull request never opened again does not keep
 * its drafts forever. Every access is guarded: storage that throws (full,
 * blocked site data) loses the draft, never the editor.
 */
export const createExpiringDraftStore = ({
  storage,
  retentionDays,
  now = Date.now,
}: ExpiringDraftStoreOptions): DraftStore => {
  const isExpired = (draft: StoredDraft): boolean =>
    now() - draft.savedAt > retentionDays * dayMs;

  try {
    const keys = Array.from({ length: storage.length }, (_, index) =>
      storage.key(index),
    ).filter((key) => key?.startsWith(prefix) === true) as string[];
    for (const key of keys) {
      const draft = parse(storage.getItem(key));
      if (draft === null || isExpired(draft)) storage.removeItem(key);
    }
  } catch {
    // nothing swept: each read still drops what expired
  }

  const remove = (key: string): void => {
    try {
      storage.removeItem(`${prefix}${key}`);
    } catch {
      // already unreadable
    }
  };

  return {
    retentionDays,
    read: (key) => {
      try {
        const draft = parse(storage.getItem(`${prefix}${key}`));
        if (draft === null) return undefined;
        if (isExpired(draft)) {
          remove(key);
          return undefined;
        }
        return draft.value;
      } catch {
        return undefined;
      }
    },
    write: (key, value) => {
      try {
        storage.setItem(
          `${prefix}${key}`,
          JSON.stringify({ savedAt: now(), value } satisfies StoredDraft),
        );
      } catch {
        // the draft lives as long as the screen
      }
    },
    remove,
  };
};
