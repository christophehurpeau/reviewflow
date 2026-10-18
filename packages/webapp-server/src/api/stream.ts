import type { Response } from "express";
import type { Query, QuerySubscription } from "liwi-store";
import { Logger } from "nightingale-logger";
import type {
  MongoStores,
  PrBucketAccount,
  PrBucketContext,
  ReviewflowPr,
} from "reviewflow-core";
import { buildPrStreamCriteria, createToPrDetail } from "reviewflow-core";
import type { PrDetail } from "reviewflow-modules";
import type { SubscriptionSlots } from "../resources/subscriptionLimits.ts";
import { ApiError } from "./apiErrors.ts";
import type { ApiAuth } from "./authenticatePersonalToken.ts";

const logger = new Logger("reviewflow:webapp-server:stream");

/** proxies close an idle connection after about a minute */
export const streamHeartbeatIntervalMs = 25_000;
/** how long a revoked token or a lost membership can keep a stream open */
export const streamRecheckIntervalMs = 60_000;
/** several writes of one pull request within it are sent as one event */
export const streamCoalesceMs = 1000;
export const maxClosedWithinDays = 30;

export type StreamResetReason = "error" | "resync" | "tokenRevoked";

export type StreamEvent =
  | {
      event: "prRemoved";
      data: { _id: string; reason: "deleted" | "outOfScope" };
    }
  | { event: "heartbeat"; data: { serverTime: string } }
  | { event: "pr"; data: PrDetail }
  | { event: "ready"; data: { serverTime: string } }
  | { event: "reset"; data: { reason: StreamResetReason } }
  | { event: "scopeChanged"; data: Record<string, never> };

export const formatStreamEvent = ({ event, data }: StreamEvent): string =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

export const parseClosedWithinDays = (value: string | undefined): number => {
  if (value === undefined) return 0;
  const days = /^\d{1,2}$/.test(value) ? Number(value) : Number.NaN;
  if (!(days <= maxClosedWithinDays)) {
    throw new ApiError(
      "badRequest",
      `\`closedWithinDays\` must be an integer from 0 to ${maxClosedWithinDays}`,
    );
  }
  return days;
};

/** `updatedAt` alone moves on writes that change nothing a reader sees */
const fingerprint = ({ updatedAt, ...detail }: PrDetail): string =>
  JSON.stringify(detail);

export interface PrStreamOptions {
  /** the pull requests in the reader's scope, as they will read them */
  query: Query<PrDetail[], any>;
  /** a pull request that left the scope, read again to tell why */
  readPr: (id: string) => Promise<ReviewflowPr | undefined>;
  toPrDetail: (pr: ReviewflowPr) => PrDetail;
  send: (event: StreamEvent) => void;
  /** the stream is over: the reader reconnects */
  end: () => void;
  coalesceMs?: number;
}

/**
 * Sends the scope as `pr` events, then `ready`, then every change as state:
 * the latest `pr` of a pull request within `coalesceMs`, unless only its
 * `updatedAt` moved. A pull request that closes gets a last `pr` with its
 * closed state; one that leaves the scope otherwise gets `prRemoved`. Any later
 * whole result (a resync of the stores, a new scope) ends the stream with
 * `reset`: the reader reconnects and gets the scope again.
 */
export const openPrStream = ({
  query,
  readPr,
  toPrDetail,
  send,
  end,
  coalesceMs = streamCoalesceMs,
}: PrStreamOptions): QuerySubscription => {
  const sentFingerprints = new Map<string, string>();
  const pending = new Map<string, StreamEvent>();
  /** a removal read asynchronously must not override a later change */
  const versions = new Map<string, number>();
  /** one window per pull request: another one's must not cut it short */
  const flushTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
  let subscription: QuerySubscription | undefined;
  let isReady = false;
  let isEnded = false;

  const sendPr = (detail: PrDetail): void => {
    const print = fingerprint(detail);
    if (sentFingerprints.get(detail._id) === print) return;
    sentFingerprints.set(detail._id, print);
    send({ event: "pr", data: detail });
  };

  const flushPr = (id: string): void => {
    clearTimeout(flushTimeouts.get(id));
    flushTimeouts.delete(id);
    const event = pending.get(id);
    pending.delete(id);
    if (event?.event === "pr") {
      sendPr(event.data);
    } else if (
      event?.event === "prRemoved" &&
      sentFingerprints.delete(event.data._id)
    ) {
      send(event);
    }
  };

  const flush = (): void => {
    [...pending.keys()].forEach(flushPr);
  };

  const queue = (id: string, event: StreamEvent): void => {
    pending.set(id, event);
    if (!flushTimeouts.has(id)) {
      flushTimeouts.set(
        id,
        setTimeout(() => {
          flushPr(id);
        }, coalesceMs),
      );
    }
  };

  const bump = (id: string): number => {
    const version = (versions.get(id) ?? 0) + 1;
    versions.set(id, version);
    return version;
  };

  const stop = (): void => {
    if (isEnded) return;
    isEnded = true;
    flushTimeouts.forEach((timeout) => {
      clearTimeout(timeout);
    });
    flushTimeouts.clear();
    subscription?.stop();
  };

  const endWith = (reason: StreamResetReason): void => {
    if (isEnded) return;
    flush();
    send({ event: "reset", data: { reason } });
    stop();
    end();
  };

  const tellRemoval = async (id: string): Promise<void> => {
    const version = bump(id);
    const pr = await readPr(id);
    if (isEnded || versions.get(id) !== version) return;
    if (pr?.isClosed) {
      queue(id, { event: "pr", data: toPrDetail(pr) });
    } else {
      queue(id, {
        event: "prRemoved",
        data: { _id: id, reason: pr ? "outOfScope" : "deleted" },
      });
    }
  };

  subscription = query.fetchAndSubscribe((error, changes) => {
    if (isEnded) return;
    if (error) {
      logger.error("Pull request stream failed", { error });
      endWith("error");
      return;
    }
    for (const change of changes) {
      if (change.type === "initial") {
        if (isReady) {
          endWith("resync");
          return;
        }
        change.initial.forEach(sendPr);
        isReady = true;
        send({
          event: "ready",
          data: { serverTime: new Date().toISOString() },
        });
      } else if (change.type === "deleted") {
        for (const key of change.keys) {
          tellRemoval(String(key)).catch((removalError: unknown) => {
            logger.error("Pull request stream failed", {
              error: removalError,
            });
            endWith("error");
          });
        }
      } else {
        for (const detail of change.result) {
          bump(detail._id);
          queue(detail._id, { event: "pr", data: detail });
        }
      }
    }
  });

  // ended by a change sent synchronously, before `subscription` was assigned
  if (isEnded) subscription.stop();
  const started = subscription;

  return {
    stop,
    cancel: stop,
    then: (onFulfilled, onRejected) => started.then(onFulfilled, onRejected),
  };
};

const dayMs = 24 * 60 * 60 * 1000;
/** the reader's client waits this long before trying again */
const retryAfterSeconds = { busy: 60, sameToken: 30 };
/**
 * Two, not one: a reader whose connection vanished (sleep, network change)
 * keeps its stream until TCP gives up, minutes later, and must be able to
 * reconnect meanwhile.
 */
export const maxStreamsPerToken = 2;
/** a reader this far behind gets the scope again by reconnecting */
export const streamMaxBufferedBytes = 1024 * 1024;

export interface ServeStreamOptions {
  mongoStores: MongoStores;
  auth: ApiAuth;
  closedWithinDays: number;
  /** what the stream's scope spans, read again every `recheckIntervalMs` */
  resolveAccounts: () => Promise<PrBucketAccount[]>;
  slots: SubscriptionSlots;
  /** open streams by token id, at most `maxStreamsPerToken` each */
  openStreams: Map<string, number>;
  heartbeatIntervalMs?: number;
  recheckIntervalMs?: number;
  maxBufferedBytes?: number;
}

const isTokenActive = async (
  mongoStores: MongoStores,
  tokenId: string,
): Promise<boolean> =>
  !!(await mongoStores.personalTokens.findOne({
    _id: tokenId,
    revokedAt: { $exists: false },
  }));

/** only a lost scope changes it: any other failure is retried on the next check */
const resolveCurrentAccounts = async (
  resolveAccounts: () => Promise<PrBucketAccount[]>,
): Promise<PrBucketAccount[]> => {
  try {
    return await resolveAccounts();
  } catch (error) {
    if (error instanceof ApiError) return [];
    throw error;
  }
};

/**
 * Refused before anything is written: a third stream of the token, or no
 * live subscription left for the user or the server. Then held open until
 * the reader leaves, the token is revoked or the scope changes.
 */
export const serveStream = async (
  res: Response,
  {
    mongoStores,
    auth,
    closedWithinDays,
    resolveAccounts,
    slots,
    openStreams,
    heartbeatIntervalMs = streamHeartbeatIntervalMs,
    recheckIntervalMs = streamRecheckIntervalMs,
    maxBufferedBytes = streamMaxBufferedBytes,
  }: ServeStreamOptions,
): Promise<void> => {
  const tokenId = auth.token._id;
  const accounts = await resolveAccounts();
  // gone during the await: its `close` was emitted before anything listened
  if (res.destroyed) return;

  const tokenStreams = openStreams.get(tokenId) ?? 0;
  if (tokenStreams >= maxStreamsPerToken) {
    throw new ApiError(
      "rateLimited",
      `This token already has ${maxStreamsPerToken} open streams`,
      retryAfterSeconds.sameToken,
    );
  }
  const slot = slots.acquire(String(auth.user.id));
  if ("limitReached" in slot) {
    throw new ApiError(
      "unavailable",
      slot.limitReached === "userLimit"
        ? "Too many live connections for this user"
        : "The server is too busy to stream",
      retryAfterSeconds.busy,
    );
  }
  openStreams.set(tokenId, tokenStreams + 1);

  res.status(200);
  res.set({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-store, no-transform",
    Connection: "keep-alive",
    // nginx buffers responses by default, which would hold the events back
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();

  const serverTime = (): { serverTime: string } => ({
    serverTime: new Date().toISOString(),
  });

  const context: PrBucketContext = { userId: auth.user.id, accounts };
  const toPrDetail = createToPrDetail(context);
  const closedSince =
    closedWithinDays > 0
      ? new Date(Date.now() - closedWithinDays * dayMs)
      : undefined;

  let isClosed = false;
  let isReady = false;
  let isRechecking = false;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let recheck: ReturnType<typeof setInterval> | undefined;
  let stream: QuerySubscription | undefined;

  const close = (): void => {
    if (isClosed) return;
    isClosed = true;
    clearInterval(heartbeat);
    clearInterval(recheck);
    stream?.stop();
    slot.release();
    const remaining = (openStreams.get(tokenId) ?? 1) - 1;
    if (remaining === 0) openStreams.delete(tokenId);
    else openStreams.set(tokenId, remaining);
    if (!res.writableEnded) res.end();
  };
  res.on("close", close);

  const send = (event: StreamEvent): void => {
    if (res.writableEnded) return;
    res.write(formatStreamEvent(event));
    if (event.event === "ready") {
      // the initial scope is written at once, whatever its size
      isReady = true;
    } else if (isReady && res.writableLength > maxBufferedBytes) {
      res.write(
        formatStreamEvent({ event: "reset", data: { reason: "error" } }),
      );
      close();
    }
  };

  stream = openPrStream({
    query: mongoStores.prs.createQueryCollection({
      criteria: buildPrStreamCriteria(context, { closedSince }),
      sort: { created: -1 },
      transformer: toPrDetail,
    }) as Query<PrDetail[], any>,
    readPr: (id) => mongoStores.prs.findByKey(id),
    toPrDetail,
    send,
    end: close,
  });
  // closed by a change sent synchronously, before `stream` was assigned
  if (isClosed) {
    stream.stop();
    return;
  }

  heartbeat = setInterval(() => {
    send({ event: "heartbeat", data: serverTime() });
  }, heartbeatIntervalMs);

  const recheckReader = async (): Promise<void> => {
    if (!(await isTokenActive(mongoStores, tokenId))) {
      send({ event: "reset", data: { reason: "tokenRevoked" } });
      close();
      return;
    }
    const current = await resolveCurrentAccounts(resolveAccounts);
    if (JSON.stringify(current) !== JSON.stringify(accounts)) {
      send({ event: "scopeChanged", data: {} });
      close();
    }
  };
  recheck = setInterval(() => {
    // lookups slowed down by mongo must not pile up
    if (isRechecking) return;
    isRechecking = true;
    recheckReader()
      .catch((error: unknown) => {
        logger.error("Could not check a pull request stream reader", { error });
      })
      .finally(() => {
        isRechecking = false;
      });
  }, recheckIntervalMs);
};
