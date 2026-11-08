import type {
  DiffStep,
  DiffWhitespace,
  PullRequestDiffResponse,
  PullRequestRef,
} from "@reviewflow/sdk";
import type {
  PullRequestDiffRefusal,
  PullRequestImpactsState,
  PullRequestReadingOrderState,
  PullRequestShas,
  RepositoryAttachment,
} from "../dataSource.ts";
import { usePullRequestDataSource } from "../dataSource.ts";

/** A pull request and the two shas its diff is read between. */
export interface PullRequestDiffTarget extends PullRequestRef {
  head: string;
  base: string;
}

interface DiffState {
  diff: PullRequestDiffResponse | null;
  error: string | null;
  loading: boolean;
  /** what a read in progress is waiting on, when the source says */
  step: DiffStep | null;
  /** the source would not read: no checkout it may use */
  refused: PullRequestDiffRefusal | null;
}

/**
 * Keyed by the source on the range, which two shas name for good: a diff once
 * read is not read again, and the previous diff stays while the next loads.
 */
export const usePullRequestDiff = (
  { ownerRepo, number, head, base }: PullRequestDiffTarget,
  whitespace: DiffWhitespace,
): DiffState => {
  const { useDiff } = usePullRequestDataSource();
  const { value, error, reading, step, refused } = useDiff(
    { ownerRepo, number },
    { head, base, whitespace },
  );
  return { diff: value, error, loading: reading, step, refused };
};

const useAlwaysAttached = (): RepositoryAttachment => ({
  status: "attached",
  detail: "",
});

/**
 * Why the diff's options that read every file or every commit are off, or
 * null when the repository has a local checkout: from GitHub they would cost
 * a request a commit, and the reading order is read from git only. A source
 * without `useRepositoryAttachment` always has its checkouts; an attachment
 * not known yet, or not readable, counts as none.
 */
export const useMissingCheckoutReason = (
  ref: PullRequestRef,
): string | null => {
  const { useRepositoryAttachment } = usePullRequestDataSource();
  const attachment = (useRepositoryAttachment ?? useAlwaysAttached)(ref);
  if (attachment === null) {
    return "Whether the repository has a local checkout is not known";
  }
  if (attachment.status === "attached") return null;
  return `Needs a local checkout: ${attachment.detail}`;
};

const notOrdered: PullRequestReadingOrderState = {
  value: null,
  cached: false,
  reading: false,
  error: null,
  refused: null,
};

const useNoReadingOrder = (): PullRequestReadingOrderState => notOrdered;

interface ReadingOrderState extends PullRequestReadingOrderState {
  /** the source can order the files for reading */
  available: boolean;
}

/** Read only while `wanted`; never read again once read for a range. */
export const usePullRequestReadingOrder = (
  { ownerRepo, number, head, base }: PullRequestDiffTarget,
  wanted: boolean,
): ReadingOrderState => {
  const { useReadingOrder } = usePullRequestDataSource();
  const read = (useReadingOrder ?? useNoReadingOrder)(
    { ownerRepo, number },
    wanted ? { head, base } : null,
  );
  return { ...read, available: useReadingOrder !== undefined };
};

const notAnalyzed: PullRequestImpactsState = {
  value: null,
  cached: false,
  reading: false,
  error: null,
  refused: null,
};

const useNoImpacts = (): PullRequestImpactsState => notAnalyzed;

/** Read only while `wanted`; never read again once read for a range. */
export const usePullRequestImpacts = (
  { ownerRepo, number, head, base }: PullRequestDiffTarget,
  wanted: boolean,
): PullRequestImpactsState => {
  const { useImpacts } = usePullRequestDataSource();
  return (useImpacts ?? useNoImpacts)(
    { ownerRepo, number },
    wanted ? { head, base } : null,
  );
};

/**
 * The diff shows a range the pull request has left (a review in progress
 * pinned it). Threads and viewed marks are read on the pull request's own
 * range, so on a file changed since then a thread's line names other code and a
 * viewed mark would be set on a version not shown.
 */
export interface PullRequestMovedOn {
  /** every path changed since the diff's head, renames by both names; null until known */
  paths: ReadonlySet<string> | null;
  /** the old side's lines name another base */
  baseMoved: boolean;
}

const renameSourcePattern = /^rename from (.+)$/gmu;

export const changedPathsOf = (diff: PullRequestDiffResponse): Set<string> =>
  new Set([
    ...diff.groups.flatMap(({ paths }) => paths),
    ...diff.omitted.map(({ path }) => path),
    ...[...diff.patch.matchAll(renameSourcePattern)].flatMap(([, from]) =>
      from === undefined ? [] : [from],
    ),
  ]);

/**
 * Unknown counts as every file changed: a misplaced thread is worse than a
 * listed one. Whitespace is shown whatever the diff hides: a line reindented
 * since the review started still moved what a thread's number names.
 */
export const usePullRequestMovedOn = (
  ref: PullRequestRef,
  shown: PullRequestShas | null,
  latest: PullRequestShas | null,
): PullRequestMovedOn | null => {
  const headMoved =
    shown !== null && latest !== null && shown.head !== latest.head;
  const { useDiff } = usePullRequestDataSource();
  const { value: data, cached } = useDiff(
    { ownerRepo: ref.ownerRepo, number: ref.number },
    headMoved
      ? { base: shown.head, head: latest.head, whitespace: "show" }
      : null,
  );
  if (shown === null || latest === null) return null;
  const baseMoved = shown.base !== latest.base;
  if (!headMoved && !baseMoved) return null;
  if (!headMoved) return { paths: new Set(), baseMoved };
  // a cached value is the previous range's, kept while this one loads
  return {
    paths: data === null || cached ? null : changedPathsOf(data),
    baseMoved,
  };
};
