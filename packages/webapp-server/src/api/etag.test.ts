import { describe, expect, it } from "vitest";
import express from "express";
import type { MongoStores, PersonalToken, ReviewflowPr } from "reviewflow-core";
import { hashPersonalToken } from "../auth/personalTokens.ts";
import { callApp } from "../tests/callRouter.ts";
import { liveRelayState } from "../tests/relayState.ts";
import apiRouter from "./apiRouter.ts";

const plainToken = "rfp_valid-token";

/** accounts are cached per token id: every case uses a token of its own */
const createToken = (_id: string, userId: number): PersonalToken => ({
  _id,
  userId,
  userLogin: `user-${userId}`,
  name: "vigie on MacBook",
  hash: hashPersonalToken(plainToken),
  prefix: "rfp_vali",
  created: new Date("2026-10-01T09:00:00Z"),
  updated: new Date("2026-10-01T09:00:00Z"),
});

const createPr = (title: string): ReviewflowPr =>
  ({
    _id: "pr-412",
    account: { id: 1, login: "elax", type: "Organization" },
    repo: { id: 20, name: "api" },
    pr: { number: 412 },
    commentId: 1,
    headRef: "feat/etag",
    headRepoFullName: "elax/api",
    title,
    isDraft: false,
    isClosed: false,
    reviews: {
      approved: [],
      changesRequested: [],
      commented: [],
      dismissed: [],
      reviewRequested: [{ id: 42, login: "user-42" }],
      teamReviewRequested: [],
      reviewed: [],
    },
    assignees: [],
    created: new Date("2026-10-01T09:00:00Z"),
    updated: new Date("2026-10-02T10:00:00Z"),
  }) as unknown as ReviewflowPr;

/** `state.pr` is what every store answers: replacing it is a write by the bot */
const createApp = (
  tokenId: string,
  userId: number,
  state: { pr: ReviewflowPr },
) => {
  const isRequestedBy = (criteria: Record<string, unknown>) =>
    JSON.stringify(criteria["reviews.reviewed.id"]) ===
    JSON.stringify({ $ne: userId });

  const mongoStores = {
    personalTokens: {
      findOne: () => Promise.resolve(createToken(tokenId, userId)),
      partialUpdateByKey: () => Promise.resolve(),
    },
    orgMembers: {
      findAll: () =>
        Promise.resolve([{ org: { id: 1, login: "elax" }, teams: [] }]),
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
        ]),
      findByKey: () => Promise.resolve({ _id: 1, installationId: 100 }),
    },
    users: {
      findByKey: () =>
        Promise.resolve({ _id: userId, paidFeatures: { enabled: true } }),
    },
    repositories: {
      findOne: () => Promise.resolve({ _id: 20, fullName: "elax/api" }),
    },
    prs: {
      findOne: (criteria: Record<string, unknown>) =>
        Promise.resolve(criteria["pr.number"] === 412 ? state.pr : null),
      findAll: () => Promise.resolve([state.pr]),
      count: (criteria: Record<string, unknown>) =>
        Promise.resolve(isRequestedBy(criteria) ? 1 : 0),
      createQueryCollection: ({
        criteria,
      }: {
        criteria: Record<string, unknown>;
      }) => ({
        fetch: <T>(onFulfilled: (result: { result: ReviewflowPr[] }) => T) =>
          Promise.resolve(
            onFulfilled({ result: isRequestedBy(criteria) ? [state.pr] : [] }),
          ),
      }),
    },
  } as unknown as MongoStores;

  const app = express();
  app.use(
    "/api",
    apiRouter({ mongoStores }, { getRelayState: liveRelayState }),
  );
  return app;
};

const lookupBody = JSON.stringify({
  targets: [{ ownerRepo: "elax/api", headRef: "feat/etag" }],
});

const call = (
  app: express.Express,
  method: "GET" | "POST",
  url: string,
  extra: Record<string, string> = {},
) =>
  callApp(app, {
    method,
    url,
    headers: {
      authorization: `Bearer ${plainToken}`,
      ...(method === "POST"
        ? {
            "content-type": "application/json",
            "content-length": String(Buffer.byteLength(lookupBody)),
          }
        : {}),
      ...extra,
    },
    body: method === "POST" ? lookupBody : undefined,
  });

const conditionalEndpoints = [
  "/api/pr/v1/elax/api/412",
  "/api/board/v1",
  "/api/board-bucket/v1?bucket=requested-reviews",
];

describe.each(conditionalEndpoints)("ETag on GET %s", (url) => {
  it("answers 200 with a weak ETag, and the same one on a repeat", async () => {
    const app = createApp(`t-etag-200-${url}`, 42, { pr: createPr("a") });

    const first = await call(app, "GET", url);
    const second = await call(app, "GET", url);

    expect(first.status).toBe(200);
    expect(first.headers.etag).toMatch(/^W\/"[^"]+"$/);
    expect(second.headers.etag).toBe(first.headers.etag);
  });

  it("answers 304 without a body when If-None-Match matches", async () => {
    const app = createApp(`t-etag-304-${url}`, 42, { pr: createPr("a") });
    const { headers } = await call(app, "GET", url);

    const response = await call(app, "GET", url, {
      "if-none-match": String(headers.etag),
    });

    expect(response.status).toBe(304);
    expect(response.body).toBe("");
    expect(response.headers.etag).toBe(headers.etag);
  });

  it("answers 200 with a new ETag once the data changed", async () => {
    const state = { pr: createPr("a") };
    const app = createApp(`t-etag-changed-${url}`, 42, state);
    const { headers } = await call(app, "GET", url);

    state.pr = createPr("b");
    const response = await call(app, "GET", url, {
      "if-none-match": String(headers.etag),
    });

    expect(response.status).toBe(200);
    expect(response.body).not.toBe("");
    expect(response.headers.etag).not.toBe(headers.etag);
  });

  it("answers 200 to a stale or unrelated If-None-Match", async () => {
    const app = createApp(`t-etag-stale-${url}`, 42, { pr: createPr("a") });

    const response = await call(app, "GET", url, {
      "if-none-match": 'W/"stale"',
    });

    expect(response.status).toBe(200);
  });
});

describe("ETag depends on the caller", () => {
  it("differs between readers when myBuckets differs", async () => {
    const state = { pr: createPr("a") };
    const requested = await call(
      createApp("t-etag-user-42", 42, state),
      "GET",
      "/api/pr/v1/elax/api/412",
    );
    const other = await call(
      createApp("t-etag-user-43", 43, state),
      "GET",
      "/api/pr/v1/elax/api/412",
    );

    expect(requested.headers.etag).not.toBe(other.headers.etag);
  });

  it("does not answer 304 to another reader's ETag", async () => {
    const state = { pr: createPr("a") };
    const { headers } = await call(
      createApp("t-etag-reader-42", 42, state),
      "GET",
      "/api/board/v1",
    );

    const response = await call(
      createApp("t-etag-reader-43", 43, state),
      "GET",
      "/api/board/v1",
      { "if-none-match": String(headers.etag) },
    );

    expect(response.status).toBe(200);
  });
});

describe("errors", () => {
  it("never answer 304, whatever the If-None-Match", async () => {
    const app = createApp("t-etag-errors", 42, { pr: createPr("a") });
    const { headers } = await call(app, "GET", "/api/board/v1");
    const matching = { "if-none-match": String(headers.etag) };

    const notFound = await call(app, "GET", "/api/pr/v1/elax/api/999", {
      "if-none-match": "*",
    });
    const forbidden = await call(app, "GET", "/api/board/v1?account=acme", {
      "if-none-match": "*",
    });
    const badRequest = await call(
      app,
      "GET",
      "/api/board-bucket/v1?bucket=nope",
      matching,
    );
    const unauthenticated = await callApp(app, {
      method: "GET",
      url: "/api/board/v1",
      headers: { "if-none-match": "*" },
    });

    expect(notFound.status).toBe(404);
    expect(forbidden.status).toBe(403);
    expect(badRequest.status).toBe(400);
    expect(unauthenticated.status).toBe(401);
    for (const response of [notFound, forbidden, badRequest, unauthenticated]) {
      expect(response.body).not.toBe("");
      expect(response.headers.etag).toBeUndefined();
    }
  });
});

describe("POST /api/prs-lookup/v1", () => {
  it("answers 200 without ETag, even to If-None-Match", async () => {
    const app = createApp("t-etag-lookup", 42, { pr: createPr("a") });

    const first = await call(app, "POST", "/api/prs-lookup/v1");
    const second = await call(app, "POST", "/api/prs-lookup/v1", {
      "if-none-match": "*",
    });

    expect(first.status).toBe(200);
    expect(first.headers.etag).toBeUndefined();
    expect(second.status).toBe(200);
    expect(second.body).toBe(first.body);
  });
});
