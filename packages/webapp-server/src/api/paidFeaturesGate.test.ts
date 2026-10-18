import { describe, expect, it } from "vitest";
import express from "express";
import type { MongoStores, PersonalToken } from "reviewflow-core";
import { hashPersonalToken } from "../auth/personalTokens.ts";
import { callApp } from "../tests/callRouter.ts";
import { liveRelayState } from "../tests/relayState.ts";
import apiRouter from "./apiRouter.ts";
import type { ApiAuth } from "./authenticatePersonalToken.ts";
import { resolveBoardAccounts } from "./board.ts";
import { resolveRepository } from "./resolveRepository.ts";
import { resolveTokenAccounts } from "./tokenAccounts.ts";

const plainToken = "rfp_gate-token";

const createToken = (_id: string): PersonalToken => ({
  _id,
  userId: 42,
  userLogin: "jane-doe",
  name: "vigie",
  hash: hashPersonalToken(plainToken),
  prefix: "rfp_gate",
  created: new Date("2026-10-01T09:00:00Z"),
  updated: new Date("2026-10-01T09:00:00Z"),
  lastUsedAt: new Date(),
  lastUsedIp: "unknown",
});

interface Flags {
  /** the user's own account */
  user?: boolean;
  /** elax allows tokens, acme does not, globex allows them */
  elax?: boolean;
  acme?: boolean;
  globex?: boolean;
}

const paid = (isEnabled: boolean | undefined) =>
  isEnabled ? { paidFeatures: { enabled: true } } : {};

const createStores = ({ user, elax, acme, globex }: Flags): MongoStores =>
  ({
    personalTokens: {
      findOne: (criteria: { _id: string }) =>
        Promise.resolve(createToken(criteria._id)),
      partialUpdateByKey: () => Promise.resolve(),
    },
    orgMembers: {
      findAll: () =>
        Promise.resolve([
          { org: { id: 1, login: "elax" }, teams: [] },
          { org: { id: 2, login: "acme" }, teams: [] },
          { org: { id: 3, login: "globex" }, teams: [] },
        ]),
    },
    orgs: {
      findAll: () =>
        Promise.resolve([
          {
            _id: 1,
            login: "elax",
            config: { allowPersonalTokens: true },
            ...paid(elax),
          },
          { _id: 2, login: "acme", config: {}, ...paid(acme) },
          {
            _id: 3,
            login: "globex",
            config: { allowPersonalTokens: true },
            ...paid(globex),
          },
        ]),
      findByKey: (id: number) =>
        Promise.resolve({ _id: id, installationId: 100 }),
    },
    users: { findByKey: () => Promise.resolve({ _id: 42, ...paid(user) }) },
    repositories: {
      findOne: () => Promise.resolve({ _id: 20, fullName: "elax/api" }),
    },
  }) as unknown as MongoStores;

const auth = (tokenId: string): ApiAuth => ({
  token: createToken(tokenId),
  user: { id: 42, login: "jane-doe" },
});

const loginsOf = async (flags: Flags, tokenId: string): Promise<string[]> => {
  const accounts = await resolveTokenAccounts(
    createStores(flags),
    auth(tokenId),
  );
  return accounts.map(({ login }) => login);
};

describe("resolveTokenAccounts", () => {
  it("reads nothing by default", async () => {
    expect(await loginsOf({}, "t-none")).toEqual([]);
  });

  it("reads the own account once the admin enabled it", async () => {
    expect(await loginsOf({ user: true }, "t-user")).toEqual([
      "jane-doe",
    ]);
  });

  it("reads an org the admin enabled and its owners allow", async () => {
    expect(await loginsOf({ elax: true }, "t-org")).toEqual(["elax"]);
  });

  it("does not read an org enabled but not allowed by its owners", async () => {
    expect(await loginsOf({ acme: true }, "t-not-allowed")).toEqual([]);
  });

  it("reads the enabled accounts only", async () => {
    expect(await loginsOf({ user: true, elax: true }, "t-mixed")).toEqual([
      "jane-doe",
      "elax",
    ]);
    expect(await loginsOf({ user: true, globex: false }, "t-off")).toEqual([
      "jane-doe",
    ]);
  });
});

describe("the board", () => {
  it("spans the enabled accounts only", async () => {
    const accounts = await resolveBoardAccounts(
      createStores({ user: true, elax: true, acme: true }),
      auth("t-board-mixed"),
      undefined,
    );
    expect(accounts.map(({ accountId }) => accountId)).toEqual([42, 1]);
  });

  it("answers forbidden for an account that is not enabled", async () => {
    await expect(
      resolveBoardAccounts(
        createStores({ user: true }),
        auth("t-board-forbidden"),
        "elax",
      ),
    ).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("resolveRepository", () => {
  it("is forbidden when the owner is not enabled", async () => {
    expect(
      await resolveRepository(
        createStores({ user: true }),
        auth("t-repo-off"),
        "elax",
        "api",
      ),
    ).toEqual({ status: "forbidden" });
  });

  it("resolves the repository of an enabled org", async () => {
    expect(
      await resolveRepository(
        createStores({ elax: true }),
        auth("t-repo-on"),
        "elax",
        "api",
      ),
    ).toMatchObject({ status: "ok" });
  });
});

describe("the api routes", () => {
  const call = (
    flags: Flags,
    tokenId: string,
    method: "GET" | "POST",
    url: string,
    body?: string,
  ) => {
    const app = express();
    app.use(
      "/api",
      apiRouter(
        { mongoStores: createStores(flags) },
        { getRelayState: liveRelayState },
      ),
    );
    return callApp(app, {
      method,
      url,
      headers: {
        authorization: `Bearer ${plainToken.replace("gate", tokenId)}`,
        ...(body === undefined
          ? {}
          : {
              "content-type": "application/json",
              "content-length": String(Buffer.byteLength(body)),
            }),
      },
      body,
    });
  };

  it("lists no account on /me/v1 when nothing is enabled", async () => {
    const { status, body } = await call({}, "me", "GET", "/api/me/v1");
    expect(status).toBe(200);
    expect(JSON.parse(body).accounts).toEqual([]);
  });

  it("answers 403 on /board/v1, /board-bucket/v1 and /stream/v1", async () => {
    const urls = [
      "/api/board/v1",
      "/api/board-bucket/v1?bucket=drafts",
      "/api/stream/v1",
    ];
    for (const [index, url] of urls.entries()) {
      const { status } = await call({}, `403-${index}`, "GET", url);
      expect(status).toBe(403);
    }
  });

  it("answers 403 on /pr/v1 for an org that is not enabled", async () => {
    const { status } = await call({}, "pr", "GET", "/api/pr/v1/elax/api/1");
    expect(status).toBe(403);
  });

  it("answers forbidden for each target of /prs-lookup/v1", async () => {
    const { status, body } = await call(
      {},
      "lookup",
      "POST",
      "/api/prs-lookup/v1",
      JSON.stringify({ targets: [{ ownerRepo: "elax/api", headRef: "feat" }] }),
    );
    expect(status).toBe(200);
    expect(JSON.parse(body).results[0]).toMatchObject({
      found: false,
      reason: "forbidden",
    });
  });
});
