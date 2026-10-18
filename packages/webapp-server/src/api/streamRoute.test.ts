import { describe, expect, it, vi } from "vitest";
import express from "express";
import type { SubscribeCallback } from "liwi-store";
import type { MongoStores, PersonalToken } from "reviewflow-core";
import { hashPersonalToken } from "../auth/personalTokens.ts";
import { createSubscriptionSlots } from "../resources/subscriptionLimits.ts";
import type { SubscriptionLimits } from "../resources/subscriptionLimits.ts";
import { callApp } from "../tests/callRouter.ts";
import { liveRelayState } from "../tests/relayState.ts";
import apiRouter from "./apiRouter.ts";

const plainToken = "rfp_stream-token";

const createToken = (_id: string): PersonalToken => ({
  _id,
  userId: 42,
  userLogin: "christophehurpeau",
  name: "vigie",
  hash: hashPersonalToken(plainToken),
  prefix: "rfp_stre",
  created: new Date("2026-10-01T09:00:00Z"),
  updated: new Date("2026-10-01T09:00:00Z"),
  lastUsedAt: new Date(),
  lastUsedIp: "unknown",
});

interface Harness {
  app: express.Express;
  /** the subscription callback of the n-th stream opened */
  emitters: SubscribeCallback<string, unknown[]>[];
  createQueryCollection: ReturnType<typeof vi.fn>;
}

/** accounts are cached per token id: every case uses a token of its own */
const createApp = (
  tokenId: string,
  limits: SubscriptionLimits = { maxTotal: 10, maxPerUser: 10 },
): Harness => {
  const emitters: SubscribeCallback<string, unknown[]>[] = [];
  const createQueryCollection = vi.fn(() => ({
    fetchAndSubscribe: (callback: SubscribeCallback<string, unknown[]>) => {
      emitters.push(callback);
      return {
        stop: () => {},
        cancel: () => {},
        then: (onFulfilled?: () => unknown) =>
          Promise.resolve().then(onFulfilled),
      };
    },
  }));
  const mongoStores = {
    personalTokens: {
      findOne: () => Promise.resolve(createToken(tokenId)),
      partialUpdateByKey: () => Promise.resolve(),
    },
    orgMembers: { findAll: () => Promise.resolve([]) },
    orgs: { findAll: () => Promise.resolve([]) },
    prs: { createQueryCollection, findByKey: () => Promise.resolve(undefined) },
  } as unknown as MongoStores;

  const app = express();
  app.use(
    "/api",
    apiRouter(
      { mongoStores },
      {
        getRelayState: liveRelayState,
        subscriptionSlots: createSubscriptionSlots(limits),
      },
    ),
  );
  return { app, emitters, createQueryCollection };
};

const openStream = (app: express.Express, query = "") =>
  callApp(app, {
    method: "GET",
    url: `/api/stream/v1${query}`,
    headers: { authorization: `Bearer ${plainToken}` },
  });

const waitForStreams = async (
  harness: Harness,
  count: number,
): Promise<void> => {
  await vi.waitFor(() => {
    expect(harness.emitters).toHaveLength(count);
  });
};

const failStream = (harness: Harness, index: number): void => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  harness.emitters[index]!(new Error("ended by the test"), []);
  consoleError.mockRestore();
};

describe("GET /api/stream/v1", () => {
  it("streams the scope as server-sent events", async () => {
    const harness = createApp("t-stream");
    const response = openStream(harness.app);

    await waitForStreams(harness, 1);
    harness.emitters[0]!(null, [
      {
        type: "initial",
        initial: [{ _id: "pr-1", updatedAt: "2026-10-18T10:00:00.000Z" }],
        meta: { total: 1 },
        queryInfo: {} as any,
      },
    ]);
    failStream(harness, 0);
    const { status, headers, body } = await response;

    expect(status).toBe(200);
    expect(headers["content-type"]).toBe("text/event-stream; charset=utf-8");
    expect(headers["x-accel-buffering"]).toBe("no");
    expect(body).toMatch(
      /^event: pr\ndata: \{"_id":"pr-1",.*\}\n\nevent: ready\ndata: \{"serverTime":".*"\}\n\nevent: reset\ndata: \{"reason":"error"\}\n\n$/,
    );
  });

  it("answers 429 to a second stream of the same token", async () => {
    const harness = createApp("t-second");
    const first = openStream(harness.app);
    await waitForStreams(harness, 1);

    const second = await openStream(harness.app);

    expect(second.status).toBe(429);
    expect(second.headers["retry-after"]).toBe("30");
    failStream(harness, 0);
    await first;
  });

  it("answers 503 past the user's live subscriptions", async () => {
    const harness = createApp("t-busy", { maxTotal: 10, maxPerUser: 0 });

    const response = await openStream(harness.app);

    expect(response.status).toBe(503);
    expect(response.headers["retry-after"]).toBe("60");
    expect(JSON.parse(response.body)).toEqual({
      error: {
        code: "unavailable",
        message: "Too many live connections for this user",
      },
    });
    expect(harness.createQueryCollection).not.toHaveBeenCalled();
  });

  it("answers 400 for an invalid `closedWithinDays`", async () => {
    const harness = createApp("t-days");

    const response = await openStream(harness.app, "?closedWithinDays=90");

    expect(response.status).toBe(400);
    expect(harness.createQueryCollection).not.toHaveBeenCalled();
  });

  it("frees the slot once the stream ends", async () => {
    const harness = createApp("t-slot", { maxTotal: 1, maxPerUser: 1 });
    const first = openStream(harness.app);
    await waitForStreams(harness, 1);
    failStream(harness, 0);
    await first;

    const second = openStream(harness.app);
    await waitForStreams(harness, 2);
    failStream(harness, 1);

    const { status } = await second;
    expect(status).toBe(200);
  });
});
