import type {
  PullRequestChange,
  PullRequestRef,
  ReviewflowBoardResponse,
  ReviewflowBoardSnapshot,
  ReviewflowClient,
  ReviewflowConnectionStatus,
  ReviewflowPrResponse,
  ReviewflowStreamEvent,
  ReviewflowStreamState,
} from "@reviewflow/sdk";
import {
  applyStreamEvent,
  assembleBoard,
  createReviewflowClient,
  createReviewflowFollower,
  readAccountBoards,
  readReviewflowStream,
  withAccountBoard,
} from "@reviewflow/sdk";
import { appLogger } from "nightingale-app-console";
import type { CredentialStore } from "./credentials/store.ts";
import { errorMessage } from "./errorMessage.ts";
import { createEventHub, formatEvent } from "./eventStream.ts";
import {
  normaliseReviewflowUrl,
  readReviewflowConnection,
  withoutToken,
  writeReviewflowConnection,
} from "./reviewflowConnection.ts";

/**
 * What the reviewflow routes and `/api/events` stand on: the stored
 * connection, the board held in memory, and the follower that keeps both
 * fresh while a client watches. Reading reviewflow, the stream and the clock
 * are injected, so a test reaches no network.
 */

export interface SetReviewflowTokenRequest {
  /** the reviewflow server, e.g. `https://reviewflow.example.com` */
  url: string;
  token: string;
}

export const tokenRefusedCode = "ERR_REVIEWFLOW_TOKEN_REFUSED";

export interface ReviewflowService {
  status: () => ReviewflowConnectionStatus;
  /** verified against reviewflow first; throws a `tokenRefusedCode` error and stores nothing otherwise */
  setToken: (
    request: SetReviewflowTokenRequest,
  ) => Promise<ReviewflowConnectionStatus>;
  clearToken: () => ReviewflowConnectionStatus;
  /** held in memory; read from reviewflow when empty or when `refresh` */
  board: (refresh: boolean) => Promise<ReviewflowBoardResponse>;
  /** read from reviewflow at each call, never kept */
  pr: (ref: PullRequestRef) => Promise<ReviewflowPrResponse>;
  /** an `/api/events` connection; returns how it is closed */
  subscribe: (write: (chunk: string) => void) => () => void;
  close: () => void;
}

export interface ReviewflowServiceOptions {
  store?: CredentialStore;
  createClient?: (connection: {
    url: string;
    token: string;
  }) => ReviewflowClient;
  openStream?: (
    connection: { url: string; token: string },
    signal: AbortSignal,
  ) => AsyncIterable<ReviewflowStreamEvent>;
  now?: () => Date;
}

const logger = appLogger.child("reviewflow", "Reviewflow");

const refused = (message: string): Error =>
  Object.assign(new Error(message), { code: tokenRefusedCode });

export const createReviewflowService = ({
  store,
  createClient = createReviewflowClient,
  openStream = ({ url, token }, signal) =>
    readReviewflowStream({
      url,
      token,
      signal,
      logger,
    }),
  now = () => new Date(),
}: ReviewflowServiceOptions = {}): ReviewflowService => {
  let snapshot: ReviewflowBoardSnapshot = {};
  let streamError: string | null = null;
  /** bumped when the token changes: a read started before belongs to the old one */
  let generation = 0;
  let boardRead: { generation: number; done: Promise<void> } | null = null;

  /** an unreadable credentials file is reported, never read as "no token" */
  const connection = (): {
    stored: ReturnType<typeof readReviewflowConnection>;
    error: string | null;
  } => {
    try {
      return { stored: readReviewflowConnection(store), error: null };
    } catch (error) {
      return { stored: null, error: errorMessage(error) };
    }
  };

  const status = (): ReviewflowConnectionStatus => {
    const { stored, error } = connection();
    return {
      configured: stored !== null,
      url: stored?.url ?? null,
      login: stored?.login ?? null,
      accounts: stored?.accounts ?? [],
      // oxlint-disable-next-line eslint/no-use-before-define
      stream: stored === null ? "off" : follower.state(),
      error: error ?? streamError,
    };
  };

  const boardResponse = (): ReviewflowBoardResponse => {
    const { stored } = connection();
    return assembleBoard(snapshot, stored?.login ?? null, stored?.accounts);
  };

  const hub = createEventHub({
    onCountChanged: (count) => {
      // oxlint-disable-next-line eslint/no-use-before-define
      follower.setWatched(count > 0);
    },
  });
  const emitStatus = (): void => {
    hub.broadcast("reviewflowStatus", status());
  };
  const emitBoard = (): void => {
    hub.broadcast("board", boardResponse());
  };

  const follower = createReviewflowFollower({
    connect: () => {
      const { stored } = connection();
      if (stored === null) return null;
      const { url, token } = stored;
      return {
        client: createClient({ url, token }),
        events: (signal) => openStream({ url, token }, signal),
      };
    },
    accounts: () => connection().stored?.accounts ?? [],
    onPr: (pr) => {
      const applied = applyStreamEvent(snapshot, { type: "pr", pr });
      snapshot = applied.snapshot;
      if (applied.changed) emitBoard();
    },
    onPrRemoved: (id) => {
      const applied = applyStreamEvent(snapshot, { type: "prRemoved", id });
      snapshot = applied.snapshot;
      if (applied.changed) emitBoard();
    },
    onAccountBoard: (account, groups) => {
      snapshot = withAccountBoard(snapshot, account, {
        groups,
        fetchedAt: now().toISOString(),
      });
      emitBoard();
    },
    onBoardError: (account, message) => {
      logger.warn("reviewflow board read failed", { account, error: message });
    },
    onPullRequestChanged: (change: PullRequestChange) => {
      hub.broadcast("pullRequestChanged", change);
    },
    onStateChanged: (_state: ReviewflowStreamState, error) => {
      streamError = error;
      emitStatus();
    },
    onLog: ({ level, message, error, fields }) => {
      logger[level](
        message,
        error === undefined ? fields : { ...fields, error },
      );
    },
  });

  const readBoards = async (readGeneration: number): Promise<void> => {
    const { stored } = connection();
    if (stored === null) return;
    const client = createClient({ url: stored.url, token: stored.token });
    const read = await readAccountBoards(client, stored.accounts);
    if (readGeneration !== generation) return;
    const fetchedAt = now().toISOString();
    for (const { account, groups } of read.boards) {
      snapshot = withAccountBoard(snapshot, account, { groups, fetchedAt });
    }
    if (read.boards.length === 0 && read.errors.length > 0) {
      throw new Error(
        withoutToken(
          read.errors.map((e) => `${e.account}: ${e.message}`).join("; "),
          stored.token,
        ),
      );
    }
    if (read.boards.length > 0) emitBoard();
  };

  return {
    status,

    setToken: async ({ url, token }) => {
      const origin = (() => {
        try {
          return normaliseReviewflowUrl(url);
        } catch (error) {
          throw refused(errorMessage(error));
        }
      })();
      const trimmed = token.trim();
      // a token that saves cleanly can still be revoked or belong to another server
      const me = await createClient({ url: origin, token: trimmed })
        .me()
        .catch((error: unknown) => {
          throw refused(
            `reviewflow refused the token: ${withoutToken(errorMessage(error), trimmed)}`,
          );
        });
      generation++;
      writeReviewflowConnection(
        {
          url: origin,
          token: trimmed,
          login: me.login,
          accounts: me.accounts.map((account) => account.login),
          lastVerifiedAt: now().toISOString(),
        },
        store,
      );
      snapshot = {};
      streamError = null;
      follower.restart();
      emitStatus();
      emitBoard();
      return status();
    },

    clearToken: () => {
      generation++;
      writeReviewflowConnection(null, store);
      snapshot = {};
      streamError = null;
      follower.restart();
      emitStatus();
      emitBoard();
      return status();
    },

    board: async (refresh) => {
      const { stored } = connection();
      const empty =
        stored !== null &&
        !stored.accounts.some((account) => snapshot[account] !== undefined);
      if (stored !== null && (refresh || empty)) {
        if (boardRead?.generation !== generation) {
          const read = {
            generation,
            done: readBoards(generation).finally(() => {
              if (boardRead === read) boardRead = null;
            }),
          };
          boardRead = read;
        }
        await boardRead.done;
      }
      return boardResponse();
    },

    pr: async ({ ownerRepo, number }) => {
      const { stored } = connection();
      if (stored === null) return { pr: null };
      const client = createClient({ url: stored.url, token: stored.token });
      try {
        return { pr: await client.pr(ownerRepo, number) };
      } catch (error) {
        throw new Error(withoutToken(errorMessage(error), stored.token), {
          cause: error,
        });
      }
    },

    subscribe: (write) =>
      hub.subscribe(write, [formatEvent("reviewflowStatus", status())]),

    close: () => {
      follower.close();
    },
  };
};
