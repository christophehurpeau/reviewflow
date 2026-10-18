import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { describe, expect, it, vi } from "vitest";
import type { Response } from "express";
import express from "express";
import type { SubscribeCallback } from "liwi-store";
import type { MongoStores, PrBucketAccount } from "reviewflow-core";
import { createSubscriptionSlots } from "../resources/subscriptionLimits.ts";
import { ApiError } from "./apiErrors.ts";
import type { ApiAuth } from "./authenticatePersonalToken.ts";
import type { ServeStreamOptions } from "./stream.ts";
import { serveStream } from "./stream.ts";

const auth: ApiAuth = {
  token: { _id: "t-1", name: "vigie", created: new Date("2026-10-01") },
  user: { id: 42, login: "christophehurpeau" },
};

const accounts: PrBucketAccount[] = [{ accountId: 42, teams: [] }];

/**
 * An express response without a socket: what it writes stays buffered, so
 * `writableLength` grows as it would for a reader that does not read.
 */
const createResponse = () => {
  const response = new ServerResponse(new IncomingMessage(new Socket()));
  Object.setPrototypeOf(response, express.response);
  const chunks: string[] = [];
  const write = response.write.bind(response);
  response.write = ((chunk: string) => {
    chunks.push(chunk);
    return write(chunk);
  }) as ServerResponse["write"];
  return { res: response as unknown as Response, chunks };
};

const createHarness = (overrides: Partial<ServeStreamOptions> = {}) => {
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
      findOne: vi.fn(() => Promise.resolve({ _id: auth.token._id })),
    },
    prs: { createQueryCollection, findByKey: () => Promise.resolve(undefined) },
  } as unknown as MongoStores;
  const slots = createSubscriptionSlots({ maxTotal: 10, maxPerUser: 10 });
  const openStreams = new Map<string, number>();
  const { res, chunks } = createResponse();

  const served = serveStream(res, {
    mongoStores,
    auth,
    closedWithinDays: 0,
    resolveAccounts: () => Promise.resolve(accounts),
    slots,
    openStreams,
    heartbeatIntervalMs: 60_000,
    recheckIntervalMs: 60_000,
    ...overrides,
  });

  return {
    res,
    chunks,
    emitters,
    createQueryCollection,
    mongoStores,
    slots,
    openStreams,
    served,
  };
};

const sendScope = (
  emit: SubscribeCallback<string, unknown[]>,
  initial: unknown[],
): void => {
  emit(null, [
    {
      type: "initial",
      initial,
      meta: { total: initial.length },
      queryInfo: {} as any,
    },
  ]);
};

describe("serveStream", () => {
  it("opens nothing for a reader gone while its accounts were read", async () => {
    let resolveAccounts: (value: PrBucketAccount[]) => void = () => {};
    const harness = createHarness({
      resolveAccounts: () =>
        new Promise((resolve) => {
          resolveAccounts = resolve;
        }),
    });

    harness.res.destroy();
    resolveAccounts(accounts);
    await harness.served;

    expect(harness.slots.getCounts().total).toBe(0);
    expect(harness.openStreams.size).toBe(0);
    expect(harness.createQueryCollection).not.toHaveBeenCalled();
  });

  it("releases the slot and the token's count once the reader leaves", async () => {
    const harness = createHarness();
    await harness.served;
    expect(harness.slots.getCounts().total).toBe(1);
    expect(harness.openStreams.get(auth.token._id)).toBe(1);

    harness.res.emit("close");

    expect(harness.slots.getCounts().total).toBe(0);
    expect(harness.openStreams.size).toBe(0);
  });

  it("ends the stream of a reader that falls behind, not while the scope is sent", async () => {
    const harness = createHarness({
      heartbeatIntervalMs: 5,
      maxBufferedBytes: 2000,
    });
    await harness.served;

    sendScope(harness.emitters[0]!, [{ _id: "pr-1", title: "x".repeat(3000) }]);
    expect(harness.chunks.at(-1)).toMatch(/^event: ready\n/);

    await vi.waitFor(() => {
      expect(harness.chunks.at(-1)).toBe(
        'event: reset\ndata: {"reason":"error"}\n\n',
      );
    });
    expect(harness.slots.getCounts().total).toBe(0);
  });

  it("keeps the stream open when the accounts cannot be read for a while", async () => {
    const resolveAccounts = vi
      .fn<() => Promise<PrBucketAccount[]>>()
      .mockResolvedValueOnce(accounts)
      .mockRejectedValue(new Error("mongo is down"));
    const harness = createHarness({ resolveAccounts, recheckIntervalMs: 5 });
    await harness.served;

    await vi.waitFor(() => {
      expect(resolveAccounts.mock.calls.length).toBeGreaterThan(2);
    });

    expect(harness.chunks.join("")).not.toContain("scopeChanged");
    expect(harness.slots.getCounts().total).toBe(1);
    harness.res.emit("close");
  });

  it("ends with scopeChanged when the token reads none of the accounts any more", async () => {
    const resolveAccounts = vi
      .fn<() => Promise<PrBucketAccount[]>>()
      .mockResolvedValueOnce(accounts)
      .mockRejectedValue(new ApiError("forbidden", "lost"));
    const harness = createHarness({ resolveAccounts, recheckIntervalMs: 5 });
    await harness.served;

    await vi.waitFor(() => {
      expect(harness.chunks.at(-1)).toBe("event: scopeChanged\ndata: {}\n\n");
    });
    expect(harness.slots.getCounts().total).toBe(0);
  });

  it("never runs two checks of the reader at once", async () => {
    const resolveAccounts = vi
      .fn<() => Promise<PrBucketAccount[]>>()
      .mockResolvedValueOnce(accounts)
      .mockReturnValue(new Promise(() => {}));
    const harness = createHarness({ resolveAccounts, recheckIntervalMs: 5 });
    await harness.served;

    await vi.waitFor(() => {
      expect(resolveAccounts).toHaveBeenCalledTimes(2);
    });
    await new Promise((resolve) => {
      setTimeout(resolve, 30);
    });

    expect(resolveAccounts).toHaveBeenCalledTimes(2);
    expect(harness.mongoStores.personalTokens.findOne).toHaveBeenCalledTimes(1);
    harness.res.emit("close");
  });
});
