import { describe, expect, it, vi } from "vitest";
import express from "express";
import type { MongoStores } from "reviewflow-core";
import { callApp } from "../tests/callRouter.ts";
import apiRouter from "./apiRouter.ts";
import { createHealthChecker } from "./health.ts";

const createConnection = (command: () => Promise<unknown>) => {
  const dbCommand = vi.fn(command);
  const getConnection = vi.fn(() =>
    Promise.resolve({ db: () => ({ command: dbCommand }) }),
  );
  return {
    dbCommand,
    getConnection,
    stores: { connection: { getConnection } } as unknown as MongoStores,
  };
};

const unknownPropagation = { propagation: "unknown", lagSeconds: null };

describe("createHealthChecker", () => {
  it("is ok when mongo answers the ping", async () => {
    const { stores, dbCommand } = createConnection(() => Promise.resolve({}));

    const health = await createHealthChecker(stores).check();

    expect(health).toEqual({ status: "ok", ...unknownPropagation });
    expect(dbCommand).toHaveBeenCalledWith({ ping: 1 });
  });

  it("is degraded when the ping fails", async () => {
    const { stores } = createConnection(() =>
      Promise.reject(new Error("mongo-secret-host:27017 refused")),
    );

    const health = await createHealthChecker(stores).check();

    expect(health).toEqual({ status: "degraded", ...unknownPropagation });
  });

  it("is degraded when the ping does not answer in time", async () => {
    const { stores } = createConnection(
      () =>
        new Promise(() => {
          /* never settles */
        }),
    );

    const health = await createHealthChecker(stores, {
      pingTimeoutMs: 10,
    }).check();

    expect(health.status).toBe("degraded");
  });

  it("shares one ping between concurrent calls and caches the answer", async () => {
    let time = 1000;
    const { stores, dbCommand } = createConnection(() => Promise.resolve({}));
    const checker = createHealthChecker(stores, {
      cacheMs: 5000,
      now: () => time,
    });

    await Promise.all([checker.check(), checker.check(), checker.check()]);
    time += 4000;
    await checker.check();
    expect(dbCommand).toHaveBeenCalledTimes(1);

    time += 1001;
    await checker.check();
    expect(dbCommand).toHaveBeenCalledTimes(2);
  });
});

describe("GET /api/health/v1", () => {
  const createApp = (command: () => Promise<unknown>) => {
    const { stores } = createConnection(command);
    const findOne = vi.fn(() => Promise.resolve(undefined));
    const app = express();
    app.use(
      "/api",
      apiRouter({
        mongoStores: {
          ...stores,
          personalTokens: { findOne },
        } as unknown as MongoStores,
      }),
    );
    return { app, findOne };
  };

  it("answers without a token and without a token lookup", async () => {
    const { app, findOne } = createApp(() => Promise.resolve({}));

    const response = await callApp(app, {
      method: "GET",
      url: "/api/health/v1",
    });

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      status: "ok",
      ...unknownPropagation,
    });
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(findOne).not.toHaveBeenCalled();
  });

  it("answers 200 degraded when mongo is down", async () => {
    const { app } = createApp(() => Promise.reject(new Error("down")));

    const response = await callApp(app, {
      method: "GET",
      url: "/api/health/v1",
    });

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      status: "degraded",
      ...unknownPropagation,
    });
  });

  it("is not blocked by failed authentications from the same ip", async () => {
    const { app } = createApp(() => Promise.resolve({}));
    for (let i = 0; i < 12; i++) {
      await callApp(app, { method: "GET", url: "/api/me/v1" });
    }
    const blocked = await callApp(app, { method: "GET", url: "/api/me/v1" });
    expect(blocked.status).toBe(429);

    const response = await callApp(app, {
      method: "GET",
      url: "/api/health/v1",
    });

    expect(response.status).toBe(200);
  });
});
