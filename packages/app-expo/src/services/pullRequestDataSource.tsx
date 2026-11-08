import type {
  DiffImpactsResponse,
  DiffReadingOrderResponse,
  DiffRefusal,
  DiffStep,
  EditPullRequestResponse,
  PullRequestCandidatesResponse,
  PullRequestDiffResponse,
  PullRequestEdit,
  PullRequestFileContentsResponse,
  PullRequestFilesResponse,
  PullRequestPart,
  PullRequestPartResponse,
  PullRequestRef,
  PullRequestRevisionsResponse,
  ReviewflowPrResponse,
} from "@reviewflow/sdk";
import {
  isPullRequestOnBoard,
  isPullRequestPart,
  withFileViewed,
} from "@reviewflow/sdk";
import type {
  PullRequestDataSource,
  PullRequestDiffRange,
  PullRequestDiffState,
  PullRequestDiffsState,
  PullRequestImpactsState,
  PullRequestReadState,
  PullRequestReadingOrderState,
  RepositoryAttachment,
} from "@reviewflow/ui";
import { errorToMessage } from "@reviewflow/ui";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getJson, getNdjson, postJson } from "./api.ts";
import { repoAttachmentKey } from "./configApi.ts";
import { useLiveState } from "./liveEvents.tsx";
import {
  partsKey,
  pullRequestKey,
  reviewflowPrKey,
} from "./pullRequestKeys.ts";
import {
  boardQueryKey,
  readBoard,
  readStatus,
  statusQueryKey,
} from "./reviewflowApi.ts";

const refQuery = ({
  ownerRepo,
  number,
}: PullRequestRef): Record<string, string> => ({
  repo: ownerRepo,
  number: String(number),
});

const partStaleTimeMs = 60_000;

/**
 * Whether reviewflow would announce a change to this pull request: this page's
 * events are live, the server follows reviewflow's stream, and the pull request
 * is on the board that stream keeps. Both queries are kept by the live events.
 */
const useAnnouncedByReviewflow = (ref: PullRequestRef): boolean => {
  const live = useLiveState() === "live";
  const { data: status } = useQuery({
    queryKey: statusQueryKey,
    queryFn: readStatus,
    staleTime: Infinity,
  });
  const streamed = status?.stream === "live";
  const { data: board } = useQuery({
    queryKey: boardQueryKey,
    queryFn: () => readBoard(false),
    enabled: streamed,
    staleTime: Infinity,
  });
  return (
    live &&
    streamed &&
    board !== undefined &&
    isPullRequestOnBoard(board.board, ref)
  );
};

const stateOf = <T,>(query: {
  data: T | undefined;
  isFetching: boolean;
  error: unknown;
}): PullRequestReadState<T> => ({
  value: query.data ?? null,
  // the server has no cache: a value is always an answer from GitHub
  cached: false,
  reading: query.isFetching,
  error: query.error === null ? null : errorToMessage(query.error),
});

/**
 * A part older than a minute is read again when shown. That re-read is not
 * reported as `reading` while reviewflow announces this pull request's
 * changes and has not said this part changed: it only confirms what is shown.
 * Otherwise (no live events, no stream, a pull request off the board, a part
 * invalidated by an event, a reload or an edit) it is.
 */
const usePart = <Part extends PullRequestPart>(
  ref: PullRequestRef,
  part: Part,
): PullRequestReadState<PullRequestPartResponse<Part>> => {
  const queryKey = [...partsKey(ref), part];
  const announced = useAnnouncedByReviewflow(ref);
  const client = useQueryClient();
  const query = useQuery({
    queryKey,
    queryFn: () =>
      getJson<PullRequestPartResponse<Part>>("/api/prs/detail", {
        ...refQuery(ref),
        part,
      }),
    staleTime: partStaleTimeMs,
  });
  const state = stateOf(query);
  const confirming =
    announced &&
    query.data !== undefined &&
    client.getQueryState(queryKey)?.isInvalidated !== true;
  return confirming ? { ...state, reading: false } : state;
};

const useCandidates = (
  ref: PullRequestRef,
): PullRequestReadState<PullRequestCandidatesResponse> =>
  stateOf(
    useQuery({
      queryKey: [...pullRequestKey(ref), "candidates"],
      queryFn: () =>
        getJson<PullRequestCandidatesResponse>(
          "/api/prs/candidates",
          refQuery(ref),
        ),
      staleTime: Infinity,
    }),
  );

const useRevisions = (
  ref: PullRequestRef,
  subjectId: string,
): PullRequestReadState<PullRequestRevisionsResponse> =>
  stateOf(
    useQuery({
      queryKey: [...pullRequestKey(ref), "revisions", subjectId],
      queryFn: () =>
        getJson<PullRequestRevisionsResponse>("/api/prs/revisions", {
          ...refQuery(ref),
          subject: subjectId,
        }),
    }),
  );

type DiffAnswer =
  | { refused: DiffRefusal; result: null }
  | { refused: null; result: PullRequestDiffResponse };

const isStep = (value: unknown): value is DiffStep =>
  value === "fetching" || value === "diffing";

/** Reads the stream: `step` lines go to `onStep`, the terminal line is the answer. */
const readDiff = async (
  ref: PullRequestRef,
  { head, base, whitespace }: PullRequestDiffRange,
  onStep: (step: DiffStep) => void,
  signal: AbortSignal,
): Promise<DiffAnswer> => {
  for await (const line of getNdjson(
    "/api/prs/diff",
    { ...refQuery(ref), head, base, whitespace, stream: "1" },
    signal,
  )) {
    const message = line as {
      step?: unknown;
      result?: PullRequestDiffResponse;
      refused?: DiffRefusal;
      error?: unknown;
    };
    if (isStep(message.step)) onStep(message.step);
    else if (message.result !== undefined) {
      return { refused: null, result: message.result };
    } else if (message.refused !== undefined) {
      return { refused: message.refused, result: null };
    } else if (typeof message.error === "string") {
      throw new Error(message.error); // oxlint-disable-line unicorn/prefer-type-error
    }
  }
  throw new Error("the diff read ended without an answer");
};

/** Unknown (no banner) until the server answers, and when it cannot: the diff says why itself. */
const useRepositoryAttachment = (
  ref: PullRequestRef,
): RepositoryAttachment | null => {
  const { data } = useQuery({
    queryKey: repoAttachmentKey(ref.ownerRepo),
    queryFn: () =>
      getJson<RepositoryAttachment>("/api/config/repo", {
        repo: ref.ownerRepo,
      }),
  });
  return data ?? null;
};

const useReviewflowPr = (
  ref: PullRequestRef,
): PullRequestReadState<ReviewflowPrResponse> =>
  stateOf(
    useQuery({
      queryKey: reviewflowPrKey(ref),
      queryFn: () =>
        getJson<ReviewflowPrResponse>("/api/reviewflow/pr", refQuery(ref)),
      staleTime: partStaleTimeMs,
    }),
  );

const diffKey = (
  ref: PullRequestRef,
  range: PullRequestDiffRange | null,
): unknown[] => [
  ...pullRequestKey(ref),
  "diff",
  range?.head,
  range?.base,
  range?.whitespace,
];

const useDiff = (
  ref: PullRequestRef,
  range: PullRequestDiffRange | null,
): PullRequestDiffState => {
  const [step, setStep] = useState<DiffStep | null>(null);
  const query = useQuery({
    // the two shas name the range for good: read once, never stale
    queryKey: diffKey(ref, range),
    queryFn: async ({ signal }) => {
      try {
        return await readDiff(ref, range!, setStep, signal);
      } finally {
        setStep(null);
      }
    },
    enabled: range !== null,
    staleTime: Infinity,
    placeholderData: keepPreviousData,
  });
  const reading = query.isFetching;
  return {
    value: query.data?.result ?? null,
    cached: query.isPlaceholderData,
    reading,
    error: query.error === null ? null : errorToMessage(query.error),
    step: reading ? step : null,
    refused: query.data?.refused ?? null,
  };
};

const diffsConcurrency = 4;

/**
 * The last range first, alone: the commits of a pull request are read oldest
 * first, and fetching the newest brings every other one into the checkout, so
 * the reads after it do not each fetch the same objects at once.
 */
const readDiffs = async (
  client: QueryClient,
  ref: PullRequestRef,
  ranges: readonly PullRequestDiffRange[],
): Promise<DiffAnswer[]> => {
  const read = (range: PullRequestDiffRange): Promise<DiffAnswer> =>
    client.query({
      queryKey: diffKey(ref, range),
      queryFn: ({ signal }) => readDiff(ref, range, () => {}, signal),
      staleTime: Infinity,
    });
  const last = ranges.at(-1);
  if (last === undefined) return [];
  const answers: DiffAnswer[] = Array.from({ length: ranges.length });
  answers[ranges.length - 1] = await read(last);
  const rest = [...ranges.slice(0, -1).entries()];
  const work = async (): Promise<void> => {
    for (let taken = rest.shift(); taken !== undefined; taken = rest.shift()) {
      const [index, range] = taken;
      answers[index] = await read(range);
    }
  };
  await Promise.all(Array.from({ length: diffsConcurrency }, work));
  return answers;
};

const useDiffs = (
  ref: PullRequestRef,
  ranges: readonly PullRequestDiffRange[] | null,
): PullRequestDiffsState => {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: [
      ...pullRequestKey(ref),
      "diffs",
      ...(ranges ?? []).flatMap(({ head, base, whitespace }) => [
        head,
        base,
        whitespace,
      ]),
    ],
    queryFn: () => readDiffs(client, ref, ranges!),
    enabled: ranges !== null,
    staleTime: Infinity,
  });
  const answers = query.data;
  const refused = answers?.find((answer) => answer.refused !== null)?.refused;
  return {
    value:
      answers === undefined || refused !== undefined
        ? null
        : answers.flatMap(({ result }) => (result === null ? [] : [result])),
    cached: false,
    reading: query.isFetching,
    error: query.error === null ? null : errorToMessage(query.error),
    refused: refused ?? null,
  };
};

type ReadingOrderAnswer =
  | DiffReadingOrderResponse
  | { refused: DiffRefusal; groups?: undefined };

const useReadingOrder = (
  ref: PullRequestRef,
  range: { head: string; base: string } | null,
): PullRequestReadingOrderState => {
  const query = useQuery({
    // the two shas name the range for good: read once, never stale
    queryKey: [
      ...pullRequestKey(ref),
      "readingOrder",
      range?.head,
      range?.base,
    ],
    queryFn: () =>
      getJson<ReadingOrderAnswer>("/api/prs/reading-order", {
        ...refQuery(ref),
        head: range!.head,
        base: range!.base,
      }),
    enabled: range !== null,
    staleTime: Infinity,
  });
  const answer = query.data;
  return {
    value: answer?.groups === undefined ? null : answer,
    cached: false,
    reading: query.isFetching,
    error: query.error === null ? null : errorToMessage(query.error),
    refused:
      answer !== undefined && "refused" in answer ? answer.refused : null,
  };
};

type ImpactsAnswer =
  | DiffImpactsResponse
  | { refused: DiffRefusal; tooLarge?: undefined };

const impactsRetryIntervalMs = 3000;
const maxImpactsRetries = 3;

/** The server parsed part of the tree before its time budget: asking again goes further. */
const isTimedOut = (answer: ImpactsAnswer | undefined): boolean =>
  answer?.tooLarge === true && answer.reason === "time";

const useImpacts = (
  ref: PullRequestRef,
  range: { head: string; base: string } | null,
): PullRequestImpactsState => {
  const query = useQuery({
    // the two shas name the range for good: read once, never stale
    queryKey: [...pullRequestKey(ref), "impacts", range?.head, range?.base],
    queryFn: () =>
      getJson<ImpactsAnswer>("/api/prs/impacts", {
        ...refQuery(ref),
        head: range!.head,
        base: range!.base,
      }),
    enabled: range !== null,
    // an answer is final, except one given up on for time
    staleTime: ({ state }) => (isTimedOut(state.data) ? 0 : Infinity),
    refetchInterval: ({ state }) =>
      isTimedOut(state.data) && state.dataUpdateCount <= maxImpactsRetries
        ? impactsRetryIntervalMs
        : false,
  });
  const answer = query.data;
  return {
    value: answer?.tooLarge === undefined ? null : answer,
    cached: false,
    reading: query.isFetching,
    error: query.error === null ? null : errorToMessage(query.error),
    refused:
      answer !== undefined && "refused" in answer ? answer.refused : null,
  };
};

/**
 * The data source over the app server. Built once per query client: `edit`,
 * `reload` and `readFileAtSha` are not hooks, so they hold the client.
 */
export const createPullRequestDataSource = (
  client: QueryClient,
): PullRequestDataSource => ({
  usePart,
  useCandidates,
  useRevisions,
  useDiff,
  useDiffs,
  useReadingOrder,
  useImpacts,
  useRepositoryAttachment,
  useReviewflowPr,

  readFileAtSha: async (ref, sha, path) => {
    const file = await getJson<PullRequestFileContentsResponse>(
      "/api/prs/file",
      { ...refQuery(ref), sha, path },
    );
    return file.contents;
  },

  edit: async (ref: PullRequestRef, edit: PullRequestEdit) => {
    const answer = await postJson<EditPullRequestResponse>("/api/prs/edit", {
      ...ref,
      edit,
    });
    if (edit.kind === "viewed") {
      // a viewed mark stales no part, so the files held take it in place
      client.setQueryData<PullRequestFilesResponse>(
        [...partsKey(ref), "files"],
        (files) =>
          files === undefined
            ? undefined
            : withFileViewed(files, edit.path, edit.viewed),
      );
    }
    return answer;
  },

  reload: async (ref, parts) => {
    const key = partsKey(ref);
    const wanted = (part: unknown): part is PullRequestPart =>
      isPullRequestPart(part) && (parts === undefined || parts.includes(part));
    try {
      // the parts a mounted component shows are read now, the others when
      // shown; invalidated, so `usePart` reports the read
      await Promise.all([
        client.invalidateQueries({
          predicate: ({ queryKey }) =>
            queryKey.length === key.length + 1 &&
            key.every((segment, index) => queryKey[index] === segment) &&
            wanted(queryKey[key.length]),
          refetchType: "active",
        }),
        wanted("checks")
          ? client.invalidateQueries({
              queryKey: reviewflowPrKey(ref),
              refetchType: "active",
            })
          : undefined,
      ]);
    } catch {
      // the queries hold their failure, which the screen shows
    }
  },
});
