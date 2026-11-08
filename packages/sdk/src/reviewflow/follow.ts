import type { PullRequestChange } from "../api/pullRequest.ts";
import { accountOfOwnerRepo } from "./board.ts";
import { changedPullRequestParts } from "./changedParts.ts";
import type {
  ReviewflowClient,
  ReviewflowGroup,
  ReviewflowPrDetail,
} from "./client.ts";
import { isReviewflowFailure } from "./client.ts";
import type { ReviewflowStreamEvent } from "./stream.ts";

/**
 * reviewflow's stream, followed while someone looks: open while at least one
 * watcher is connected, closed `lingerMs` after the last one leaves. A stream
 * nobody watches holds one of the live connections reviewflow allows per user
 * and in total.
 *
 * Storage is the caller's: the follower reports what it learned through
 * callbacks, and all it keeps is what the lifecycle needs.
 */

export const lingerMs = 5 * 60_000;
export const boardReadDelayMs = 3000;
export const reconnectDelayMs = 1000;
const minRetryMs = 2000;
export const maxRetryMs = 5 * 60_000;

export type ReviewflowStreamState = "connecting" | "error" | "live" | "off";

export interface ReviewflowConnection {
  client: Pick<ReviewflowClient, "board">;
  events: (signal: AbortSignal) => AsyncIterable<ReviewflowStreamEvent>;
}

export interface ReviewflowFollower {
  /** whether anyone is watching */
  setWatched: (watched: boolean) => void;
  /** the token changed: the open stream is the old token's */
  restart: () => void;
  state: () => ReviewflowStreamState;
  close: () => void;
}

export interface ReviewflowFollowerLog {
  level: "error" | "info" | "warn";
  message: string;
  /** the thrown value itself, for a caller that serializes its stack */
  error?: unknown;
  /** what the message is about, without the error */
  fields?: Record<string, unknown>;
}

export interface CreateReviewflowFollowerParams {
  /** null without a token; read again at each connection */
  connect: () => ReviewflowConnection | null;
  /** the accounts whose board is read, as the caller spells them */
  accounts: () => string[];
  /** the scope the stream sent before `ready`, then each later `pr` */
  onPr: (pr: ReviewflowPrDetail, phase: "change" | "scope") => void;
  onPrRemoved: (id: string) => void;
  /** an account's board was read again */
  onAccountBoard: (account: string, groups: ReviewflowGroup[]) => void;
  onBoardError?: (account: string, message: string) => void;
  /** parts of a pull request's screen went stale */
  onPullRequestChanged?: (change: PullRequestChange) => void;
  onStateChanged?: (state: ReviewflowStreamState, error: string | null) => void;
  /** the stream connected, failed or ended; for a log */
  onLog?: (entry: ReviewflowFollowerLog) => void;
}

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const retryDelayMs = (error: unknown, failures: number): number => {
  if (isReviewflowFailure(error)) {
    if (error.retryAfterMs !== undefined) return error.retryAfterMs;
    // a revoked token stays revoked until another is stored: `restart`
    if (error.status === 401) return maxRetryMs;
  }
  return Math.min(minRetryMs * 2 ** (failures - 1), maxRetryMs);
};

const wait = async (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    const done = (): void => {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener("abort", done, { once: true });
  });

interface BoardRead {
  timer?: ReturnType<typeof setTimeout>;
  inFlight: boolean;
  again: boolean;
}

export const createReviewflowFollower = ({
  connect,
  accounts,
  onPr,
  onPrRemoved,
  onAccountBoard,
  onBoardError,
  onPullRequestChanged,
  onStateChanged,
  onLog,
}: CreateReviewflowFollowerParams): ReviewflowFollower => {
  let watched = false;
  let state: ReviewflowStreamState = "off";
  let controller: AbortController | null = null;
  let linger: ReturnType<typeof setTimeout> | undefined;
  const boardReads = new Map<string, BoardRead>();
  /** which account a pull request is from, for a `prRemoved` that only names it */
  const accountOfPr = new Map<string, string>();
  /** kept across connections: a scope sent anew reports what changed meanwhile */
  const lastSeen = new Map<string, ReviewflowPrDetail>();

  const setState = (next: ReviewflowStreamState, error?: string): void => {
    if (state === next && error === undefined) return;
    state = next;
    onStateChanged?.(next, error ?? null);
  };

  const comparePr = (pr: ReviewflowPrDetail): void => {
    const previous = lastSeen.get(pr.id);
    lastSeen.set(pr.id, pr);
    if (previous === undefined || onPullRequestChanged === undefined) return;
    const parts = changedPullRequestParts(previous, pr);
    if (parts.length === 0) return;
    onPullRequestChanged({ ownerRepo: pr.ownerRepo, number: pr.number, parts });
  };

  const linked = (account: string): string | undefined =>
    accounts().find((owner) => owner.toLowerCase() === account.toLowerCase());

  /** true when an event arrived during the read, whose answer may predate it */
  const readBoard = async (
    connection: ReviewflowConnection,
    account: string,
    signal: AbortSignal,
  ): Promise<boolean> => {
    const read = boardReads.get(account);
    if (read === undefined || signal.aborted) return false;
    read.timer = undefined;
    read.inFlight = true;
    read.again = false;
    try {
      const groups = await connection.client.board(account);
      if (signal.aborted) return false;
      onAccountBoard(account, groups);
    } catch (error) {
      if (signal.aborted) return false;
      onBoardError?.(account, messageOf(error));
    } finally {
      read.inFlight = false;
    }
    return read.again;
  };

  const scheduleBoard = (
    connection: ReviewflowConnection,
    account: string,
    signal: AbortSignal,
  ): void => {
    const owner = linked(account);
    if (owner === undefined) return;
    const read = boardReads.get(owner) ?? { inFlight: false, again: false };
    boardReads.set(owner, read);
    if (read.inFlight) {
      read.again = true;
      return;
    }
    read.timer ??= setTimeout(() => {
      readBoard(connection, owner, signal)
        .then((again) => {
          if (again) scheduleBoard(connection, owner, signal);
        })
        .catch((error: unknown) => {
          onLog?.({
            level: "warn",
            message: "reviewflow board read failed",
            error,
          });
        });
    }, boardReadDelayMs);
  };

  const scheduleEveryBoard = (
    connection: ReviewflowConnection,
    signal: AbortSignal,
  ): void => {
    for (const owner of accounts()) scheduleBoard(connection, owner, signal);
  };

  /**
   * Returns when the server ends the stream, telling whether it got as far as
   * `ready`; throws when it fails.
   */
  const follow = async (
    connection: ReviewflowConnection,
    signal: AbortSignal,
    onReady: () => void,
  ): Promise<boolean> => {
    const scope: ReviewflowPrDetail[] = [];
    let ready = false;
    for await (const event of connection.events(signal)) {
      if (event.type === "end") {
        onLog?.({
          level: "info",
          message: "reviewflow ended the stream",
          fields: { reason: event.reason },
        });
        // a reset or a scope change: what the board holds may be stale
        scheduleEveryBoard(connection, signal);
        return ready;
      }
      if (event.type === "ready") {
        ready = true;
        onReady();
        onLog?.({
          level: "info",
          message: "reviewflow stream ready",
          fields: { prs: scope.length },
        });
        for (const pr of scope.splice(0)) onPr(pr, "scope");
        setState("live");
        scheduleEveryBoard(connection, signal);
      } else if (event.type === "pr") {
        accountOfPr.set(event.pr.id, accountOfOwnerRepo(event.pr.ownerRepo));
        comparePr(event.pr);
        if (ready) {
          onPr(event.pr, "change");
          scheduleBoard(
            connection,
            accountOfOwnerRepo(event.pr.ownerRepo),
            signal,
          );
        } else {
          scope.push(event.pr);
        }
      } else if (ready) {
        const account = accountOfPr.get(event.id);
        accountOfPr.delete(event.id);
        lastSeen.delete(event.id);
        onPrRemoved(event.id);
        if (account === undefined) scheduleEveryBoard(connection, signal);
        else scheduleBoard(connection, account, signal);
      }
    }
    return ready;
  };

  const run = async (signal: AbortSignal): Promise<void> => {
    let failures = 0;
    const resetFailures = (): void => {
      failures = 0;
    };
    while (!signal.aborted) {
      const connection = connect();
      if (connection === null) {
        setState("off");
        return;
      }
      let delayMs = reconnectDelayMs;
      setState("connecting");
      try {
        const reachedReady = await follow(connection, signal, resetFailures);
        if (!reachedReady && !signal.aborted) {
          failures++;
          delayMs = retryDelayMs(undefined, failures);
          onLog?.({
            level: "warn",
            message: "reviewflow ended the stream before it was ready",
            fields: { retryInMs: delayMs },
          });
        }
      } catch (error) {
        if (signal.aborted) return;
        failures++;
        delayMs = retryDelayMs(error, failures);
        onLog?.({
          level: "warn",
          message: "reviewflow stream failed",
          error,
          fields: { retryInMs: delayMs },
        });
        setState("error", messageOf(error));
      }
      if (state === "live") setState("connecting");
      await wait(delayMs, signal);
    }
  };

  const stop = (): void => {
    controller?.abort();
    controller = null;
    for (const read of boardReads.values()) clearTimeout(read.timer);
    boardReads.clear();
    accountOfPr.clear();
    setState("off");
  };

  const start = (): void => {
    if (controller !== null) return;
    const current = new AbortController();
    controller = current;
    run(current.signal)
      .catch((error: unknown) => {
        onLog?.({
          level: "error",
          message: "reviewflow stream stopped",
          error,
        });
      })
      .finally(() => {
        if (controller === current) controller = null;
      });
  };

  return {
    setWatched: (value) => {
      watched = value;
      clearTimeout(linger);
      linger = undefined;
      if (value) start();
      else if (controller !== null) linger = setTimeout(stop, lingerMs);
    },
    restart: () => {
      const wasOpen = controller !== null;
      stop();
      lastSeen.clear();
      if (watched || wasOpen) start();
    },
    state: () => state,
    close: () => {
      watched = false;
      clearTimeout(linger);
      stop();
    },
  };
};
