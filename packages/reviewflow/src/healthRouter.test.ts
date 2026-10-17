import { describe, expect, it, vi } from "vitest";
import express from "express";
import type { MongoStores } from "reviewflow-core";
import { healthRouter } from "./healthRouter.ts";
import { callApp } from "./tests/callRouter.ts";

const createApp = (command: () => Promise<unknown>): express.Express => {
  const getConnection = vi.fn(() =>
    Promise.resolve({ db: () => ({ command: vi.fn(command) }) }),
  );
  const app = express();
  app.use(
    healthRouter({ connection: { getConnection } } as unknown as MongoStores),
  );
  return app;
};

describe("GET /api/health", () => {
  it("answers 200 ok when mongo answers the ping", async () => {
    const app = createApp(() => Promise.resolve({}));

    const response = await callApp(app, { method: "GET", url: "/api/health" });

    expect(response).toEqual({ status: 200, body: { status: "ok" } });
  });

  it("answers 503 degraded when mongo is down", async () => {
    const app = createApp(() => Promise.reject(new Error("down")));

    const response = await callApp(app, { method: "GET", url: "/api/health" });

    expect(response).toEqual({ status: 503, body: { status: "degraded" } });
  });
});
