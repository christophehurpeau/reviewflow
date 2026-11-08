import type {
  ReviewflowBoardResponse,
  ReviewflowConnectionStatus,
} from "@reviewflow/sdk";
import type { ReactNode } from "react";
import { fn } from "storybook/test";
import type { BoardDataSource, BoardReadState } from "./dataSource.ts";
import { BoardDataSourceProvider } from "./dataSource.ts";
import * as fixtures from "./fixtures.ts";

export interface MockBoardOptions {
  board?: Partial<BoardReadState<ReviewflowBoardResponse>>;
  status?: ReviewflowConnectionStatus;
}

/** A board data source over fixtures, no network: what every story renders against. */
export const createMockBoardSource = ({
  board,
  status = fixtures.connectedStatus,
}: MockBoardOptions = {}): BoardDataSource => ({
  useBoard: () => ({
    value: fixtures.boardResponse,
    reading: false,
    error: null,
    ...board,
  }),
  useReviewflowStatus: () => ({
    value: status,
    reading: false,
    error: null,
  }),
  refresh: fn(() => Promise.resolve()),
});

export function MockBoardSourceProvider({
  children,
  ...options
}: MockBoardOptions & { children: ReactNode }): ReactNode {
  return (
    <BoardDataSourceProvider value={createMockBoardSource(options)}>
      {children}
    </BoardDataSourceProvider>
  );
}
