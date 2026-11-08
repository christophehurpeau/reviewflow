import type { PullRequestRef } from "@reviewflow/sdk";

const storageKey = "reviewflow:recent-pull-requests";
const maxRecent = 12;

const isRef = (value: unknown): value is PullRequestRef =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as PullRequestRef).ownerRepo === "string" &&
  typeof (value as PullRequestRef).number === "number";

/** The page works without storage (private window, blocked site data): every access is guarded. */
export const readRecentPullRequests = (): PullRequestRef[] => {
  try {
    const parsed: unknown = JSON.parse(
      globalThis.localStorage.getItem(storageKey) ?? "[]",
    );
    return Array.isArray(parsed)
      ? parsed.filter(isRef).slice(0, maxRecent)
      : [];
  } catch {
    return [];
  }
};

/** Puts `ref` first, drops its older entry; returns the new list. */
export const rememberPullRequest = (ref: PullRequestRef): PullRequestRef[] => {
  const next = [
    ref,
    ...readRecentPullRequests().filter(
      (other) =>
        other.ownerRepo !== ref.ownerRepo || other.number !== ref.number,
    ),
  ].slice(0, maxRecent);
  try {
    globalThis.localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    // not persisted: the list lives for this visit only
  }
  return next;
};
