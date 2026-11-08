import type {
  ReviewflowBoardResponse,
  ReviewflowConnectionStatus,
} from "@reviewflow/sdk";
import type { QueryClient } from "@tanstack/react-query";
import { getJson, requestJson } from "./api.ts";

export const boardQueryKey = ["reviewflow", "board"] as const;
export const statusQueryKey = ["reviewflow", "status"] as const;

export const readBoard = (refresh: boolean): Promise<ReviewflowBoardResponse> =>
  getJson<ReviewflowBoardResponse>(
    "/api/reviewflow/board",
    refresh ? { refresh: "1" } : undefined,
  );

export const readStatus = (): Promise<ReviewflowConnectionStatus> =>
  getJson<ReviewflowConnectionStatus>("/api/reviewflow/status");

/** The server verifies the token against reviewflow before storing it, and refuses with the reason. */
export const saveToken = (
  client: QueryClient,
  body: { url: string; token: string },
): Promise<ReviewflowConnectionStatus> =>
  requestJson<ReviewflowConnectionStatus>(
    "PUT",
    "/api/reviewflow/token",
    body,
  ).then((status) => {
    client.setQueryData(statusQueryKey, status);
    // the board of a previous token must not outlive it
    client.removeQueries({ queryKey: boardQueryKey });
    return status;
  });

export const forgetToken = (
  client: QueryClient,
): Promise<ReviewflowConnectionStatus> =>
  requestJson<ReviewflowConnectionStatus>(
    "DELETE",
    "/api/reviewflow/token",
  ).then((status) => {
    client.setQueryData(statusQueryKey, status);
    client.removeQueries({ queryKey: boardQueryKey });
    return status;
  });
