import type {
  DiffImpactsResponse,
  DiffReadingOrderResponse,
  DiffRefusal,
  DiffStep,
  DiffWhitespace,
  EditPullRequestResponse,
  PullRequestCandidatesResponse,
  PullRequestDiffResponse,
  PullRequestEdit,
  PullRequestPart,
  PullRequestPartResponse,
  PullRequestRef,
  PullRequestRevisionsResponse,
  PullRequestSummary,
  ReviewflowPrResponse,
} from "@reviewflow/sdk";
import { createContext, use } from "react";

/**
 * Where a read is at, as the components consume it. Every `use*` hook of the
 * data source answers with this shape.
 *
 * - `value`: the newest answer held, `null` until the first one. It carries its
 *   own age (`fetchedAt`, `checkedAt`) for the parts that are
 *   `PullRequestRead`s, which is what the screen's "read at" line shows.
 * - `cached`: `value` is an older read shown while the source reads again, not
 *   an answer to this request. A source with no cache always says `false`.
 * - `reading`: the source is reading, for the first time or over `value`, and
 *   the screen should say so. A source may leave out a re-read over a `value`
 *   it holds for up to date, one that only confirms what is shown.
 * - `error`: why the last read failed, as a message; `value` may still hold an
 *   older answer.
 */
export interface PullRequestReadState<T> {
  value: T | null;
  cached: boolean;
  reading: boolean;
  error: string | null;
}

/** Why the source did not read the diff at all; defined by the sdk, which the server answers with. */
export type PullRequestDiffRefusal = DiffRefusal;

/**
 * Whether the source can read a repository's diff from a local checkout, known
 * before any diff is asked for. `detail` says which checkout is used, or why
 * none can be.
 */
export interface RepositoryAttachment {
  status: "attached" | "invalidPath" | "notConfigured";
  detail: string;
}

/** The range a diff is read over: two shas, which name it for good. */
export interface PullRequestDiffRange {
  head: string;
  base: string;
  whitespace: DiffWhitespace;
}

export interface PullRequestDiffState extends PullRequestReadState<PullRequestDiffResponse> {
  /**
   * What the source is waiting on while `reading`: `fetching` the commits into
   * the checkout, `diffing` them. `null` when it does not know, or is not
   * reading. A large fetch takes tens of seconds, which a bare spinner hides.
   */
  step: DiffStep | null;
  /** set instead of `value` when the source refused to read, see {@link PullRequestDiffRefusal} */
  refused: PullRequestDiffRefusal | null;
}

export interface PullRequestDiffsState extends PullRequestReadState<
  PullRequestDiffResponse[]
> {
  /** the first range the source refused to read, as for the diff */
  refused: PullRequestDiffRefusal | null;
}

export interface PullRequestReadingOrderState extends PullRequestReadState<DiffReadingOrderResponse> {
  /** set instead of `value` when the source refused to read, as for the diff */
  refused: PullRequestDiffRefusal | null;
}

export interface PullRequestImpactsState extends PullRequestReadState<DiffImpactsResponse> {
  /** set instead of `value` when the source refused to read, as for the diff */
  refused: PullRequestDiffRefusal | null;
}

/**
 * What the pull request screen reads and writes through. The app provides one
 * with {@link PullRequestDataSourceProvider}; the components never reach for a
 * network or a cache themselves.
 *
 * Hooks follow the rules of hooks (called unconditionally, in the same order);
 * `ref` and the other arguments may change between renders, and the state then
 * follows them.
 */
export interface PullRequestDataSource {
  /**
   * What the app already holds of the pull request (a copy from another
   * source, reviewflow's say), enough to head the screen until the `detail`
   * part arrives. Optional: without it the screen shows its pending notice
   * alone. `null` when the app holds nothing for this pull request.
   */
  useSummary?: (ref: PullRequestRef) => PullRequestSummary | null;

  /**
   * One part of the pull request (`detail`, `checks`, `timeline`, `commits`,
   * `files`). Read when a component showing it mounts, never on a timer.
   */
  usePart: <Part extends PullRequestPart>(
    ref: PullRequestRef,
    part: Part,
  ) => PullRequestReadState<PullRequestPartResponse<Part>>;

  /**
   * Whether the repository has a local checkout the diff can be read from, so
   * the screen can say so on every tab rather than only once a diff is asked
   * for. `null` while unknown: no banner. Optional: a source that always has
   * its checkouts (or reads no diff from one) leaves it out.
   */
  useRepositoryAttachment?: (
    ref: PullRequestRef,
  ) => RepositoryAttachment | null;

  /**
   * reviewflow's copy of the pull request: its checks are judged by its rules
   * (checks allowed to fail, jobs on hold, its own check left out). Optional: a
   * source without reviewflow leaves it out, and nothing is shown in its place.
   */
  useReviewflowPr?: (
    ref: PullRequestRef,
  ) => PullRequestReadState<ReviewflowPrResponse>;

  /** What the reviewer, assignee and label editors offer. Not read again by `reload`. */
  useCandidates: (
    ref: PullRequestRef,
  ) => PullRequestReadState<PullRequestCandidatesResponse>;

  /** The edit history of a description, a comment or a review (`subjectId` is its GitHub node id). */
  useRevisions: (
    ref: PullRequestRef,
    subjectId: string,
  ) => PullRequestReadState<PullRequestRevisionsResponse>;

  /**
   * The pull request's changes over `range`. `null` reads nothing (a
   * component that may need a diff later). While a new range loads, the
   * previous `value` should stay (`cached: true`) so the viewer does not flash.
   */
  useDiff: (
    ref: PullRequestRef,
    range: PullRequestDiffRange | null,
  ) => PullRequestDiffState;

  /**
   * Several ranges' changes, each read and kept as `useDiff` reads it, so a
   * range read here is not read again there. `value` is every answer in the
   * order of `ranges`, `null` until the last one arrived. `null` reads
   * nothing.
   */
  useDiffs: (
    ref: PullRequestRef,
    ranges: readonly PullRequestDiffRange[] | null,
  ) => PullRequestDiffsState;

  /**
   * The files of the range's diff in reading order (experimental). `null`
   * reads nothing: the reader has not asked for that order. Optional: without
   * it the diff offers only its order by package.
   */
  useReadingOrder?: (
    ref: PullRequestRef,
    range: { head: string; base: string } | null,
  ) => PullRequestReadingOrderState;

  /**
   * The exports the range's change touches and the files outside the diff that
   * use them (experimental). `null` reads nothing. Optional: without it the
   * diff shows no impacts.
   */
  useImpacts?: (
    ref: PullRequestRef,
    range: { head: string; base: string } | null,
  ) => PullRequestImpactsState;

  /**
   * One file at a commit, so the diff can unfold the lines the patch left out.
   * A promise rather than a hook: it is asked from a press, long after
   * render. Rejects with a message when the file cannot be read.
   */
  readFileAtSha: (
    ref: PullRequestRef,
    sha: string,
    path: string,
  ) => Promise<string>;

  /**
   * Writes to GitHub, resolving with the server's answer once GitHub took the
   * change (`followUpError` is what failed after the write landed) and
   * rejecting with the reason when it did not. Does not re-read: the screen calls `reload`
   * with the parts `pullRequestPartsStaleAfter` names. A `viewed` edit stales
   * nothing, so the source applies it to the `files` it holds
   * (`withFileViewed`) before resolving.
   */
  edit: (
    ref: PullRequestRef,
    edit: PullRequestEdit,
  ) => Promise<EditPullRequestResponse>;

  /**
   * Reads `parts` again from GitHub, every part when absent, and resolves once
   * the parts a mounted component shows are read. A failure is held by the
   * state of the hook (`error`), so this never rejects.
   */
  reload: (
    ref: PullRequestRef,
    parts?: readonly PullRequestPart[],
  ) => Promise<void>;
}

const DataSourceContext = createContext<PullRequestDataSource | null>(null);

/** Provides the data source to every pull request component below it. */
export const PullRequestDataSourceProvider = DataSourceContext.Provider;

export const usePullRequestDataSource = (): PullRequestDataSource => {
  const source = use(DataSourceContext);
  if (source === null) {
    throw new Error(
      "usePullRequestDataSource needs a PullRequestDataSourceProvider",
    );
  }
  return source;
};

/** The shas a diff and a review are pinned to. */
export interface PullRequestShas {
  head: string;
  base: string;
}
