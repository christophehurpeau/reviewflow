import type { Response } from "express";
import type { Query, QuerySubscription } from "liwi-store";
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
  let flushTimeout: ReturnType<typeof setTimeout> | undefined;
  let subscription: QuerySubscription | undefined;
  let isReady = false;
  let isEnded = false;

  const sendPr = (detail: PrDetail): void => {
    const print = fingerprint(detail);
    if (sentFingerprints.get(detail._id) === print) return;
    sentFingerprints.set(detail._id, print);
    send({ event: "pr", data: detail });
  };

  const flush = (): void => {
    flushTimeout = undefined;
    const events = [...pending.values()];
    pending.clear();
    for (const event of events) {
      if (event.event === "pr") {
        sendPr(event.data);
      } else if (
        event.event === "prRemoved" &&
        sentFingerprints.delete(event.data._id)
      ) {
        send(event);
      }
    }
  };

  const queue = (id: string, event: StreamEvent): void => {
    pending.set(id, event);
    flushTimeout ??= setTimeout(flush, coalesceMs);
  };

  const bump = (id: string): number => {
    const version = (versions.get(id) ?? 0) + 1;
    versions.set(id, version);
    return version;
  };

  const stop = (): void => {
    if (isEnded) return;
    isEnded = true;
    clearTimeout(flushTimeout);
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
      console.error("Pull request stream failed", error);
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
            console.error("Pull request stream failed", removalError);
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

export interface ServeStreamOptions {
  mongoStores: MongoStores;
  auth: ApiAuth;
  closedWithinDays: number;
  /** what the stream's scope spans, read again every `recheckIntervalMs` */
  resolveAccounts: () => Promise<PrBucketAccount[]>;
  slots: SubscriptionSlots;
  /** token ids with an open stream: one each */
  openStreams: Set<string>;
  heartbeatIntervalMs?: number;
  recheckIntervalMs?: number;
}

const isTokenActive = async (
  mongoStores: MongoStores,
  tokenId: string,
): Promise<boolean> =>
  !!(await mongoStores.personalTokens.findOne({
    _id: tokenId,
    revokedAt: { $exists: false },
  }));

/**
 * Refused before anything is written: a second stream of the token, or no
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
  }: ServeStreamOptions,
): Promise<void> => {
  const tokenId = auth.token._id;
  const accounts = await resolveAccounts();

  if (openStreams.has(tokenId)) {
    throw new ApiError(
      "rateLimited",
      "This token already has an open stream",
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
  openStreams.add(tokenId);

  res.status(200);
  res.set({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-store, no-transform",
    Connection: "keep-alive",
    // nginx buffers responses by default, which would hold the events back
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();

  const send = (event: StreamEvent): void => {
    if (!res.writableEnded) res.write(formatStreamEvent(event));
  };
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
    openStreams.delete(tokenId);
    if (!res.writableEnded) res.end();
  };
  res.on("close", close);

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

  heartbeat = setInterval(() => {
    send({ event: "heartbeat", data: serverTime() });
  }, heartbeatIntervalMs);

  const recheckReader = async (): Promise<void> => {
    if (!(await isTokenActive(mongoStores, tokenId))) {
      send({ event: "reset", data: { reason: "tokenRevoked" } });
      close();
      return;
    }
    const current = await resolveAccounts().catch(() => []);
    if (JSON.stringify(current) !== JSON.stringify(accounts)) {
      send({ event: "scopeChanged", data: {} });
      close();
    }
  };
  recheck = setInterval(() => {
    recheckReader().catch((error: unknown) => {
      console.error("Could not check a pull request stream reader", error);
    });
  }, recheckIntervalMs);
};
