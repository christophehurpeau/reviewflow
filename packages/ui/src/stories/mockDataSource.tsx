import type {
  DiffReadingOrderResponse,
  PullRequestDetailResponse,
  PullRequestDiffResponse,
  PullRequestPartResponses,
  PullRequestSummary,
  ReviewflowPrResponse,
} from "@reviewflow/sdk";
import type { ReactNode } from "react";
import { fn } from "storybook/test";
import type {
  PullRequestDataSource,
  PullRequestDiffState,
  PullRequestImpactsState,
  PullRequestReadState,
  RepositoryAttachment,
} from "../dataSource.ts";
import { PullRequestDataSourceProvider } from "../dataSource.ts";
import * as fixtures from "./fixtures.ts";

const answered = <T,>(value: T): PullRequestReadState<T> => ({
  value,
  cached: false,
  reading: false,
  error: null,
});

const pending = <T,>(): PullRequestReadState<T> => ({
  value: null,
  cached: false,
  reading: true,
  error: null,
});

const idleDiff: PullRequestDiffState = {
  ...answered(fixtures.diff),
  step: null,
  refused: null,
};

export interface MockDataSourceOptions {
  /** defaults to the fixture's, read by a viewer who is not its author */
  detail?: PullRequestDetailResponse;
  /** the diff state the mock answers; defaults to the fixture's diff */
  diff?: Partial<PullRequestDiffState>;
  /** the pull request is still being read: no part has answered */
  loading?: boolean;
  /** whether a checkout is attached, as `useRepositoryAttachment` answers it; absent: no such hook */
  attachment?: RepositoryAttachment | null;
  /** a summary the source holds, as `useSummary` answers it; absent: no `useSummary` */
  summary?: PullRequestSummary | null;
  /** the reading order `useReadingOrder` answers once asked; defaults to the fixture's */
  readingOrder?: DiffReadingOrderResponse;
  /** the impacts state `useImpacts` answers once asked, over an answer with the fixture's impacts */
  impacts?: Partial<PullRequestImpactsState>;
  /** the diff of a range by its head, over `diff` */
  diffsByHead?: Record<string, PullRequestDiffResponse>;
  /** reviewflow's copy, as `useReviewflowPr` answers it; absent: no such hook */
  reviewflowPr?: ReviewflowPrResponse;
}

/** A data source over fixtures, no network: what every story renders against. */
export const createMockDataSource = ({
  detail = fixtures.detail,
  diff,
  loading = false,
  attachment,
  summary,
  readingOrder = fixtures.readingOrder,
  impacts,
  diffsByHead = {},
  reviewflowPr,
}: MockDataSourceOptions = {}): PullRequestDataSource => {
  const parts: PullRequestPartResponses = {
    detail,
    checks: fixtures.checks,
    timeline: fixtures.timeline,
    commits: fixtures.commits,
    files: fixtures.files,
  };
  return {
    ...(summary === undefined ? {} : { useSummary: () => summary }),
    ...(attachment === undefined
      ? {}
      : { useRepositoryAttachment: () => attachment }),
    ...(reviewflowPr === undefined
      ? {}
      : {
          useReviewflowPr: () => (loading ? pending() : answered(reviewflowPr)),
        }),
    usePart: (_ref, part) =>
      loading ? pending() : answered(parts[part] as never),
    useCandidates: () => (loading ? pending() : answered(fixtures.candidates)),
    useRevisions: () =>
      answered({
        revisionsTotal: 1,
        revisions: [
          {
            editedAt: "2026-11-05T08:00:00.000Z",
            editor: fixtures.ada,
            original: true,
            body: "First version",
            deletedBy: null,
            changes: null,
          },
        ],
      }),
    useDiff: (_ref, range) => {
      if (range === null) return { ...idleDiff, value: null };
      const ofHead = diffsByHead[range.head];
      return ofHead === undefined
        ? { ...idleDiff, ...diff }
        : { ...idleDiff, value: ofHead };
    },
    useDiffs: (_ref, ranges) => ({
      ...answered(
        ranges?.map(({ head }) => diffsByHead[head] ?? fixtures.diff) ?? null,
      ),
      refused: null,
    }),
    useReadingOrder: (_ref, range) => ({
      ...answered(range === null ? null : readingOrder),
      refused: null,
    }),
    useImpacts: (_ref, range) => ({
      ...answered(range === null ? null : fixtures.impacts),
      refused: null,
      ...impacts,
    }),
    readFileAtSha: () => Promise.resolve(""),
    edit: fn((_ref, edit) =>
      Promise.resolve({ edited: edit.kind, followUpError: null }),
    ),
    reload: fn(() => Promise.resolve()),
  };
};

interface MockDataSourceProviderProps extends MockDataSourceOptions {
  children: ReactNode;
}

export function MockDataSourceProvider({
  children,
  ...options
}: MockDataSourceProviderProps): ReactNode {
  // a module-level object per render would remount nothing, but keep one per story
  const source = createMockDataSource(options);
  return (
    <PullRequestDataSourceProvider value={source}>
      {children}
    </PullRequestDataSourceProvider>
  );
}
