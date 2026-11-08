import type {
  ReviewflowBoardResponse,
  ReviewflowConnectionStatus,
} from "@reviewflow/sdk";
import { createContext, use } from "react";

/**
 * Where a read is at: `value` is the newest answer held, `null` until the
 * first; `cached` says it is older than the request being answered; `reading`
 * that the source is reading now; `error` why the last read failed (`value`
 * may still hold an older answer).
 */
export interface BoardReadState<T> {
  value: T | null;
  reading: boolean;
  error: string | null;
  cached?: boolean;
}

/**
 * What the board reads through. The app provides one with
 * {@link BoardDataSourceProvider}; the components never reach for a network or
 * a cache themselves. Hooks follow the rules of hooks.
 */
export interface BoardDataSource {
  /** The board; the source keeps it current (live events) and re-renders on change. */
  useBoard: () => BoardReadState<ReviewflowBoardResponse>;
  /** Whether a reviewflow token is configured. `value` is null until known. */
  useReviewflowStatus: () => BoardReadState<ReviewflowConnectionStatus>;
  /** Reads the board from reviewflow again; never rejects, a failure is `useBoard().error`. */
  refresh: () => Promise<void>;
}

const BoardDataSourceContext = createContext<BoardDataSource | null>(null);

export const BoardDataSourceProvider = BoardDataSourceContext.Provider;

export const useBoardDataSource = (): BoardDataSource => {
  const source = use(BoardDataSourceContext);
  if (source === null) {
    throw new Error("useBoardDataSource needs a BoardDataSourceProvider");
  }
  return source;
};
