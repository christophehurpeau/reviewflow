import type { PullRequestRef } from "@reviewflow/sdk";
import type { BoardDataSource, BoardReadState } from "@reviewflow/ui";
import { errorToMessage } from "@reviewflow/ui";
import { useQuery } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { postJson } from "./api.ts";
import {
  boardQueryKey,
  closedQueryKey,
  readBoard,
  readClosedPullRequests,
  readStatus,
  startedReviewsQueryKey,
  statusQueryKey,
} from "./reviewflowApi.ts";

const stateOf = <T,>(query: {
  data: T | undefined;
  isFetching: boolean;
  error: unknown;
}): BoardReadState<T> => ({
  value: query.data ?? null,
  reading: query.isFetching,
  error: query.error === null ? null : errorToMessage(query.error),
});

const useReviewflowStatus: BoardDataSource["useReviewflowStatus"] = () =>
  stateOf(useQuery({ queryKey: statusQueryKey, queryFn: readStatus }));

const useBoard: BoardDataSource["useBoard"] = () => {
  const status = useQuery({ queryKey: statusQueryKey, queryFn: readStatus });
  return stateOf(
    useQuery({
      queryKey: boardQueryKey,
      queryFn: () => readBoard(false),
      // without a token the server has no board to answer
      enabled: status.data?.configured === true,
    }),
  );
};

const useClosedPullRequests: BoardDataSource["useClosedPullRequests"] = ({
  account,
  enabled,
}) =>
  stateOf(
    useQuery({
      queryKey: [...closedQueryKey, account],
      queryFn: () => readClosedPullRequests(account),
      enabled,
    }),
  );

const noStartedReviews: PullRequestRef[] = [];

/**
 * In the query cache so it outlives the screen. A row can only leave the
 * requested reviews once started, so an entry never has to be forgotten.
 */
const useStartedReviews: BoardDataSource["useStartedReviews"] = () =>
  useQuery({
    queryKey: startedReviewsQueryKey,
    initialData: noStartedReviews,
    enabled: false,
    gcTime: Number.POSITIVE_INFINITY,
  }).data;

/**
 * The board over the app server. The live events (see `liveEvents.ts`) write
 * into the same query keys, so a component reading through these hooks
 * re-renders when the server pushes.
 */
export const createBoardDataSource = (
  client: QueryClient,
): BoardDataSource => ({
  useBoard,
  useReviewflowStatus,
  useClosedPullRequests,
  useStartedReviews,
  startReview: async (ref) => {
    await postJson("/api/prs/edit", { ...ref, edit: { kind: "startReview" } });
    client.setQueryData<PullRequestRef[]>(
      startedReviewsQueryKey,
      (started = noStartedReviews) => [...started, ref],
    );
  },
  refresh: async () => {
    try {
      await client.invalidateQueries({ queryKey: closedQueryKey });
      // the failure is held by the query, which `useBoard` reports
      await client.fetchQuery({
        queryKey: boardQueryKey,
        queryFn: () => readBoard(true),
        staleTime: 0,
      });
    } catch {
      // see above
    }
  },
});
