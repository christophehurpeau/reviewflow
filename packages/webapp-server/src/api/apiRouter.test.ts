import { describe, expect, it, vi } from "vitest";
import express from "express";
import type { MongoStores, PersonalToken } from "reviewflow-core";
import { hashPersonalToken } from "../auth/personalTokens.ts";
import { callApp } from "../tests/callRouter.ts";
import { liveRelayState } from "../tests/relayState.ts";
import apiRouter from "./apiRouter.ts";

const plainToken = "rfp_valid-token";

/** accounts are cached per token id: every case uses a token of its own */
const createToken = (
  _id: string,
  overrides: Partial<PersonalToken> = {},
): PersonalToken => ({
  _id,
  userId: 42,
  userLogin: "christophehurpeau",
  name: "vigie on MacBook",
  hash: hashPersonalToken(plainToken),
  prefix: "rfp_vali",
  created: new Date("2026-10-01T09:00:00Z"),
  updated: new Date("2026-10-01T09:00:00Z"),
  ...overrides,
});

interface Harness {
  app: express.Express;
  findOne: ReturnType<typeof vi.fn>;
  partialUpdateByKey: ReturnType<typeof vi.fn>;
  orgMembersFindAll: ReturnType<typeof vi.fn>;
}

/** member of org 1 (allows tokens) and org 2 (does not) */
const createApp = (stored: PersonalToken | undefined): Harness => {
  const findOne = vi.fn(() => Promise.resolve(stored));
  const partialUpdateByKey = vi.fn(() => Promise.resolve());
  const orgMembersFindAll = vi.fn(() =>
    Promise.resolve([
      {
        org: { id: 1, login: "elax" },
        teams: [{ id: 7, name: "Squad Apps", slug: "squad-apps" }],
      },
      { org: { id: 2, login: "acme" }, teams: [] },
    ]),
  );

  const mongoStores = {
    personalTokens: { findOne, partialUpdateByKey },
    orgMembers: { findAll: orgMembersFindAll },
    orgs: {
      findAll: () =>
        Promise.resolve([
          {
            _id: 1,
            login: "elax",
            config: { allowPersonalTokens: true },
            paidFeatures: { enabled: true },
          },
          { _id: 2, login: "acme", config: {} },
        ]),
    },
    users: {
      findByKey: () =>
        Promise.resolve({ _id: 42, paidFeatures: { enabled: true } }),
    },
  } as unknown as MongoStores;

  const app = express();
  app.use(
    "/api",
    apiRouter({ mongoStores }, { getRelayState: liveRelayState }),
  );

  return { app, findOne, partialUpdateByKey, orgMembersFindAll };
};

const getMe = (app: express.Express, authorization?: string) =>
  callApp(app, {
    method: "GET",
    url: "/api/me/v1",
    headers: authorization ? { authorization } : {},
  });

describe("authentication", () => {
  it("answers 401 with the error envelope without a token", async () => {
    const { app, findOne } = createApp(createToken("t-none"));

    const response = await getMe(app);

    expect(response.status).toBe(401);
    expect(JSON.parse(response.body)).toEqual({
      error: {
        code: "unauthenticated",
        message: 'Send a personal token as "Authorization: Bearer rfp_…"',
      },
    });
    expect(findOne).not.toHaveBeenCalled();
  });

  it("rejects a bearer that is not a personal token", async () => {
    const { app, findOne } = createApp(createToken("t-jwt"));

    const response = await getMe(app, "Bearer eyJhbGciOi.jwt");

    expect(response.status).toBe(401);
    expect(findOne).not.toHaveBeenCalled();
  });

  it("looks the token up by hash among active tokens only", async () => {
    const { app, findOne } = createApp(undefined);

    const response = await getMe(app, `Bearer ${plainToken}`);

    expect(findOne).toHaveBeenCalledWith({
      hash: hashPersonalToken(plainToken),
      revokedAt: { $exists: false },
    });
    expect(response.status).toBe(401);
    expect(JSON.parse(response.body)).toMatchObject({
      error: { code: "unauthenticated", message: "Unknown or revoked token" },
    });
  });
});

describe("recording the last use", () => {
  it("records the first use without touching updated", async () => {
    const { app, partialUpdateByKey } = createApp(createToken("t-first"));

    await getMe(app, `Bearer ${plainToken}`);

    expect(partialUpdateByKey).toHaveBeenCalledWith(
      "t-first",
      { $set: { lastUsedAt: expect.any(Date), lastUsedIp: "unknown" } },
      undefined,
      { touchUpdated: false },
    );
  });

  it("skips the write within a minute from the same ip", async () => {
    const { app, partialUpdateByKey } = createApp(
      createToken("t-fresh", {
        lastUsedAt: new Date(Date.now() - 10_000),
        lastUsedIp: "unknown",
      }),
    );

    await getMe(app, `Bearer ${plainToken}`);

    expect(partialUpdateByKey).not.toHaveBeenCalled();
  });

  it("writes again after a minute", async () => {
    const { app, partialUpdateByKey } = createApp(
      createToken("t-stale", {
        lastUsedAt: new Date(Date.now() - 120_000),
        lastUsedIp: "unknown",
      }),
    );

    await getMe(app, `Bearer ${plainToken}`);

    expect(partialUpdateByKey).toHaveBeenCalled();
  });

  it("writes at once when the ip changes", async () => {
    const { app, partialUpdateByKey } = createApp(
      createToken("t-moved", {
        lastUsedAt: new Date(Date.now() - 10_000),
        lastUsedIp: "203.0.113.42",
      }),
    );

    await getMe(app, `Bearer ${plainToken}`);

    expect(partialUpdateByKey).toHaveBeenCalled();
  });
});

describe("GET /api/me/v1", () => {
  it("returns the user, the accounts the token reaches and the token", async () => {
    const { app } = createApp(createToken("t-me"));

    const response = await getMe(app, `Bearer ${plainToken}`);

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      user: { id: 42, login: "christophehurpeau" },
      accounts: [
        { id: 42, login: "christophehurpeau", type: "User", teams: [] },
        {
          id: 1,
          login: "elax",
          type: "Organization",
          teams: [{ id: 7, slug: "squad-apps", name: "Squad Apps" }],
        },
      ],
      token: {
        name: "vigie on MacBook",
        createdAt: "2026-10-01T09:00:00.000Z",
        scopes: ["read"],
      },
      serverTime: expect.any(String),
    });
  });

  it("reuses the accounts for 5 seconds per token", async () => {
    const { app, orgMembersFindAll } = createApp(createToken("t-cached"));

    await getMe(app, `Bearer ${plainToken}`);
    await getMe(app, `Bearer ${plainToken}`);

    expect(orgMembersFindAll).toHaveBeenCalledTimes(1);
  });

  it("sends no cors header", async () => {
    const { app } = createApp(createToken("t-cors"));

    const response = await getMe(app, `Bearer ${plainToken}`);

    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("errors", () => {
  it("answers an unknown endpoint with notFound", async () => {
    const { app } = createApp(createToken("t-404"));

    const response = await callApp(app, {
      method: "GET",
      url: "/api/nope",
      headers: { authorization: `Bearer ${plainToken}` },
    });

    expect(response.status).toBe(404);
    expect(JSON.parse(response.body)).toEqual({
      error: { code: "notFound", message: "Unknown endpoint" },
    });
  });

  it("does not tell an anonymous caller which endpoints exist", async () => {
    const { app } = createApp(createToken("t-404-anonymous"));

    const response = await callApp(app, { method: "GET", url: "/api/nope" });

    expect(response.status).toBe(401);
  });

  it("hides an unexpected failure behind the envelope", async () => {
    const { app, findOne } = createApp(undefined);
    findOne.mockRejectedValue(new Error("mongo is down"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const response = await getMe(app, `Bearer ${plainToken}`);

    expect(response.status).toBe(500);
    expect(JSON.parse(response.body)).toEqual({
      error: { code: "internal", message: "Unexpected error" },
    });
    consoleError.mockRestore();
  });
});

describe("rate limits", () => {
  it("answers 429 with Retry-After past 60 requests in a row", async () => {
    const { app } = createApp(createToken("t-burst"));

    for (let index = 0; index < 60; index++) {
      const response = await getMe(app, `Bearer ${plainToken}`);
      expect(response.status).toBe(200);
    }
    const limited = await getMe(app, `Bearer ${plainToken}`);

    expect(limited.status).toBe(429);
    expect(limited.headers["retry-after"]).toBe("1");
    expect(JSON.parse(limited.body)).toEqual({
      error: { code: "rateLimited", message: "Too many requests, retry in 1s" },
    });
  });

  it("stops looking tokens up after 10 failed attempts from one ip", async () => {
    const { app, findOne } = createApp(undefined);

    for (let index = 0; index < 10; index++) {
      const response = await getMe(app, `Bearer ${plainToken}`);
      expect(response.status).toBe(401);
    }
    const limited = await getMe(app, `Bearer ${plainToken}`);

    expect(limited.status).toBe(429);
    expect(limited.headers["retry-after"]).toBe("6");
    expect(findOne).toHaveBeenCalledTimes(10);
  });

  it("counts a missing token as a failed attempt too", async () => {
    const { app } = createApp(undefined);

    for (let index = 0; index < 10; index++) {
      await getMe(app);
    }
    const limited = await getMe(app);

    expect(limited.status).toBe(429);
  });

  it("does not count successful requests against the ip", async () => {
    const { app } = createApp(createToken("t-ip-ok"));

    for (let index = 0; index < 20; index++) {
      const response = await getMe(app, `Bearer ${plainToken}`);
      expect(response.status).toBe(200);
    }
  });
});
