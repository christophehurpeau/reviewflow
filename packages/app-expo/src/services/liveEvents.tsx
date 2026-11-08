import type {
  PullRequestChange,
  ReviewflowBoardResponse,
  ReviewflowConnectionStatus,
} from "@reviewflow/sdk";
import { isPullRequestPart } from "@reviewflow/sdk";
import { useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { useEffect, useSyncExternalStore } from "react";
import { partsKey, reviewflowPrKey } from "./pullRequestKeys.ts";
import { boardQueryKey, statusQueryKey } from "./reviewflowApi.ts";
import { serverBaseUrl } from "./serverBaseUrl.ts";

/**
 * The state of this page's `/api/events` connection, apart from the server's
 * own `stream` state (whether the server follows reviewflow).
 * `unavailable`: the runtime has no EventSource.
 */
export type LiveState =
  | "connecting"
  | "live"
  | "reconnecting"
  | "stopped"
  | "unavailable";

let liveState: LiveState = "stopped";
const listeners = new Set<() => void>();
const setLiveState = (next: LiveState): void => {
  if (next === liveState) return;
  liveState = next;
  for (const listener of listeners) listener();
};

export const useLiveState = (): LiveState =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => liveState,
  );

/** EventSource retries by itself unless the server answered with an error: then this does, later. */
const reconnectDelayMs = 5000;

const parse = <T,>(event: MessageEvent): T | null => {
  try {
    return JSON.parse(String(event.data)) as T;
  } catch {
    return null;
  }
};

/** Invalidates exactly the listed parts: a mounted screen re-reads at once, the others when shown. */
const invalidateParts = (
  client: QueryClient,
  { ownerRepo, number, parts }: PullRequestChange,
): void => {
  for (const part of parts) {
    if (!isPullRequestPart(part)) continue;
    client
      .invalidateQueries({
        queryKey: [...partsKey({ ownerRepo, number }), part],
      })
      .catch(() => undefined);
  }
  if (parts.includes("checks")) {
    client
      .invalidateQueries({ queryKey: reviewflowPrKey({ ownerRepo, number }) })
      .catch(() => undefined);
  }
};

/**
 * Events sent while disconnected are lost: what they would have refreshed is
 * read again. A diff names its range by shas and never goes stale.
 */
const resyncAfterGap = (client: QueryClient): void => {
  client.invalidateQueries({ queryKey: boardQueryKey }).catch(() => undefined);
  client
    .invalidateQueries({
      predicate: ({ queryKey }) =>
        queryKey[0] === "pullRequest" &&
        (queryKey[3] === "part" || queryKey[3] === "reviewflow"),
    })
    .catch(() => undefined);
};

/** Opens the one connection of the app; returns how to close it. */
export const startLiveEvents = (client: QueryClient): (() => void) => {
  if (typeof EventSource === "undefined") {
    setLiveState("unavailable");
    return () => undefined;
  }
  let source: EventSource | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let wasLive = false;

  const connect = (): void => {
    setLiveState(liveState === "live" ? "reconnecting" : "connecting");
    const next = new EventSource(`${serverBaseUrl()}/api/events`);
    source = next;
    next.addEventListener("open", () => {
      if (wasLive) resyncAfterGap(client);
      wasLive = true;
      setLiveState("live");
    });
    next.addEventListener("error", () => {
      setLiveState("reconnecting");
      if (next.readyState === EventSource.CLOSED && !stopped) {
        // the browser gave up (the server answered with an error): try again later
        timer = setTimeout(connect, reconnectDelayMs);
      }
    });
    next.addEventListener("board", (event) => {
      const board = parse<ReviewflowBoardResponse>(event);
      if (board !== null) client.setQueryData(boardQueryKey, board);
    });
    next.addEventListener("reviewflowStatus", (event) => {
      const status = parse<ReviewflowConnectionStatus>(event);
      if (status !== null) client.setQueryData(statusQueryKey, status);
    });
    next.addEventListener("pullRequestChanged", (event) => {
      const change = parse<PullRequestChange>(event);
      if (change !== null) invalidateParts(client, change);
    });
  };
  connect();

  return () => {
    stopped = true;
    if (timer !== null) clearTimeout(timer);
    source?.close();
    setLiveState("stopped");
  };
};

/** Mounted once, in the root layout. */
export function LiveEvents(): null {
  const client = useQueryClient();
  useEffect(() => startLiveEvents(client), [client]);
  return null;
}
