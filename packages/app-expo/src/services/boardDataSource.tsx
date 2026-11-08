import type { BoardDataSource, BoardReadState } from "@reviewflow/ui";
import { errorToMessage } from "@reviewflow/ui";
import { useQuery } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import {
  boardQueryKey,
  readBoard,
  readStatus,
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
  refresh: async () => {
    try {
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
