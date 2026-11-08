import { describe, expect, it } from "vitest";
import type { DraftStorage } from "./expiringDraftStore.ts";
import { createExpiringDraftStore } from "./expiringDraftStore.ts";

const dayMs = 24 * 60 * 60 * 1000;

const createMemoryStorage = (
  entries: Record<string, string> = {},
): DraftStorage & { entries: Map<string, string> } => {
  const map = new Map(Object.entries(entries));
  return {
    entries: map,
    get length() {
      return map.size;
    },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
};

describe("createExpiringDraftStore", () => {
  it("reads back what was written", () => {
    const store = createExpiringDraftStore({
      storage: createMemoryStorage(),
      retentionDays: 7,
    });
    store.write("acme/app#1:comment", "half a sentence");
    expect(store.read("acme/app#1:comment")).toBe("half a sentence");
  });

  it("reads nothing once removed", () => {
    const store = createExpiringDraftStore({
      storage: createMemoryStorage(),
      retentionDays: 7,
    });
    store.write("acme/app#1:comment", "half a sentence");
    store.remove("acme/app#1:comment");
    expect(store.read("acme/app#1:comment")).toBeUndefined();
  });

  it("drops a draft older than the retention on read", () => {
    let time = 0;
    const storage = createMemoryStorage();
    const store = createExpiringDraftStore({
      storage,
      retentionDays: 7,
      now: () => time,
    });
    store.write("acme/app#1:comment", "old");
    time = 7 * dayMs + 1;
    expect(store.read("acme/app#1:comment")).toBeUndefined();
    expect(storage.entries.size).toBe(0);
  });

  it("keeps a draft within the retention", () => {
    let time = 0;
    const store = createExpiringDraftStore({
      storage: createMemoryStorage(),
      retentionDays: 7,
      now: () => time,
    });
    store.write("acme/app#1:comment", "recent");
    time = 7 * dayMs;
    expect(store.read("acme/app#1:comment")).toBe("recent");
  });

  it("sweeps expired and unreadable drafts on creation, and only its own keys", () => {
    const storage = createMemoryStorage({
      "reviewflow:draft:a": JSON.stringify({ savedAt: 0, value: "expired" }),
      "reviewflow:draft:b": JSON.stringify({
        savedAt: 9 * dayMs,
        value: "fresh",
      }),
      "reviewflow:draft:c": "not json",
      "reviewflow:recent-pull-requests": "[]",
    });
    createExpiringDraftStore({
      storage,
      retentionDays: 7,
      now: () => 10 * dayMs,
    });
    expect([...storage.entries.keys()]).toEqual([
      "reviewflow:draft:b",
      "reviewflow:recent-pull-requests",
    ]);
  });

  it("loses the draft, not the editor, when the storage throws", () => {
    const storage = createMemoryStorage();
    storage.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    const store = createExpiringDraftStore({ storage, retentionDays: 7 });
    expect(() => {
      store.write("acme/app#1:comment", "text");
    }).not.toThrow();
    expect(store.read("acme/app#1:comment")).toBeUndefined();
  });
});
