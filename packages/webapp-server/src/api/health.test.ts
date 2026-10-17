import { describe, expect, it, vi } from "vitest";
import express from "express";
import type { MongoStores } from "reviewflow-core";
import { callApp } from "../tests/callRouter.ts";
import apiRouter from "./apiRouter.ts";

const createConnection = (command: () => Promise<unknown>) => {
  const getConnection = vi.fn(() =>
    Promise.resolve({ db: () => ({ command: vi.fn(command) }) }),
  );
  return {
    stores: { connection: { getConnection } } as unknown as MongoStores,
  };
};

const unknownPropagation = { propagation: "unknown", lagSeconds: null };

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
    expect(response.headers.etag).toBeUndefined();
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

  it("GET /api/health answers 200 ok without a token", async () => {
    const { app, findOne } = createApp(() => Promise.resolve({}));

    const response = await callApp(app, { method: "GET", url: "/api/health" });

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ status: "ok" });
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers.etag).toBeUndefined();
    expect(findOne).not.toHaveBeenCalled();
  });

  it("GET /api/health answers 503 when mongo is down", async () => {
    const { app } = createApp(() => Promise.reject(new Error("down")));

    const response = await callApp(app, { method: "GET", url: "/api/health" });

    expect(response.status).toBe(503);
    expect(JSON.parse(response.body)).toEqual({ status: "degraded" });
  });
});
