import { describe, expect, it, vi } from "vitest";
import express from "express";
import type { MongoStores, PersonalToken, ReviewflowPr } from "reviewflow-core";
import { hashPersonalToken } from "../auth/personalTokens.ts";
import { callApp } from "../tests/callRouter.ts";
import { liveRelayState } from "../tests/relayState.ts";
import apiRouter from "./apiRouter.ts";

const plainToken = "rfp_valid-token";

/** accounts are cached per token id: every case uses a token of its own */
const createToken = (_id: string): PersonalToken => ({
  _id,
  userId: 42,
  userLogin: "christophehurpeau",
  name: "vigie on MacBook",
  hash: hashPersonalToken(plainToken),
  prefix: "rfp_vali",
  created: new Date("2026-10-01T09:00:00Z"),
  updated: new Date("2026-10-01T09:00:00Z"),
});

const pr = {
  _id: "pr-id",
  account: { id: 1, login: "elax", type: "Organization" },
  repo: { id: 20, name: "api" },
  pr: { number: 412 },
  commentId: 1,
  title: "feat: add the read api",
  isDraft: false,
  isClosed: false,
  reviews: {
    approved: [],
    changesRequested: [],
    commented: [],
    dismissed: [],
    reviewRequested: [{ id: 42, login: "christophehurpeau" }],
    teamReviewRequested: [],
    reviewed: [],
  },
  assignees: [],
  created: new Date("2026-10-01T09:00:00Z"),
  updated: new Date("2026-10-02T10:00:00Z"),
} as unknown as ReviewflowPr;

/** member of org 1 (allows tokens) and org 2 (does not); repo 20 is elax/api */
const createApp = (tokenId: string) => {
  const repositoriesFindOne = vi.fn((criteria: Record<string, unknown>) => {
    const { "account.id": accountId, fullName } = criteria as {
      "account.id": number;
      fullName: { $regex: string; $options: string };
    };
    const matches =
      accountId === 1 &&
      new RegExp(fullName.$regex, fullName.$options).test("elax/api");
    return Promise.resolve(matches ? { _id: 20, fullName: "elax/api" } : null);
  });
  const prsFindOne = vi.fn((criteria: Record<string, unknown>) =>
    Promise.resolve(
      criteria["account.id"] === 1 &&
        criteria["repo.id"] === 20 &&
        criteria["pr.number"] === 412
        ? pr
        : null,
    ),
  );

  const mongoStores = {
    personalTokens: {
      findOne: () => Promise.resolve(createToken(tokenId)),
      partialUpdateByKey: () => Promise.resolve(),
    },
    orgMembers: {
      findAll: () =>
        Promise.resolve([
          { org: { id: 1, login: "elax" }, teams: [] },
          { org: { id: 2, login: "acme" }, teams: [] },
        ]),
    },
    users: {
      findByKey: () =>
        Promise.resolve({ _id: 42, paidFeatures: { enabled: true } }),
    },
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
    repositories: { findOne: repositoriesFindOne },
    prs: { findOne: prsFindOne },
  } as unknown as MongoStores;

  const app = express();
  app.use(
    "/api",
    apiRouter({ mongoStores }, { getRelayState: liveRelayState }),
  );

  return { app, repositoriesFindOne, prsFindOne };
};

const getPr = (app: express.Express, path: string) =>
  callApp(app, {
    method: "GET",
    url: `/api/pr/v1/${path}`,
    headers: { authorization: `Bearer ${plainToken}` },
  });

describe("GET /api/pr/v1/:owner/:repo/:number", () => {
  it("returns the pull request detail for the reader", async () => {
    const { app, prsFindOne } = createApp("t-pr-ok");

    const response = await getPr(app, "elax/api/412");

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      _id: "pr-id",
      ownerRepo: "elax/api",
      number: 412,
      state: "open",
      myBuckets: ["requested-reviews"],
      updatedAt: "2026-10-02T10:00:00.000Z",
    });
    expect(prsFindOne).toHaveBeenCalledWith({
      "account.id": 1,
      "repo.id": 20,
      "pr.number": 412,
    });
  });

  it("matches the owner and the repository case-insensitively", async () => {
    const { app } = createApp("t-pr-case");

    const response = await getPr(app, "ELAX/Api/412");

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({ ownerRepo: "elax/api" });
  });

  it("answers 404 for an unknown pull request, repository or number", async () => {
    const { app } = createApp("t-pr-404");

    for (const path of [
      "elax/api/999",
      "elax/nope/412",
      "elax/api/0",
      "elax/api/abc",
      "elax/api/1e3",
    ]) {
      const response = await getPr(app, path);
      expect(response.status, path).toBe(404);
      expect(JSON.parse(response.body)).toEqual({
        error: { code: "notFound", message: "Pull request not found" },
      });
    }
  });

  it("answers 403 for an organization that does not allow tokens, without looking any data up", async () => {
    const { app, repositoriesFindOne, prsFindOne } = createApp("t-pr-403");

    const response = await getPr(app, "acme/api/412");

    expect(response.status).toBe(403);
    expect(JSON.parse(response.body)).toEqual({
      error: {
        code: "forbidden",
        message: "The token cannot read this account",
      },
    });
    expect(repositoriesFindOne).not.toHaveBeenCalled();
    expect(prsFindOne).not.toHaveBeenCalled();
  });

  it("answers the same 403 for an owner nobody knows, and for a pull request that does not exist", async () => {
    const { app } = createApp("t-pr-403-same");

    const unknown = await getPr(app, "stranger/api/412");
    const missing = await getPr(app, "acme/nope/1");

    expect(unknown.status).toBe(403);
    expect(missing.status).toBe(403);
    expect(unknown.body).toBe(missing.body);
  });

  it("requires a token", async () => {
    const { app } = createApp("t-pr-401");

    const response = await callApp(app, {
      method: "GET",
      url: "/api/pr/v1/elax/api/412",
    });

    expect(response.status).toBe(401);
  });
});
