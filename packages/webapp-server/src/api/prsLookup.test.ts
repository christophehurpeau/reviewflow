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

const createPr = (
  number: number,
  headRef: string | undefined,
  headRepoFullName: string | null | undefined,
  repoId = 20,
): ReviewflowPr =>
  ({
    _id: `pr-${repoId}-${number}`,
    account: { id: 1, login: "elax", type: "Organization" },
    repo: { id: repoId, name: "api" },
    pr: { number },
    commentId: 1,
    headRef,
    headRepoFullName,
    title: `pr ${number}`,
    isDraft: false,
    isClosed: false,
    reviews: {
      approved: [],
      changesRequested: [],
      commented: [],
      dismissed: [],
      reviewRequested: [],
      teamReviewRequested: [],
      reviewed: [],
    },
    assignees: [],
    created: new Date("2026-10-01T09:00:00Z"),
    updated: new Date("2026-10-02T10:00:00Z"),
  }) as unknown as ReviewflowPr;

/**
 * Org 1 (elax, installed, allows tokens) owns repositories 20 `api`, 21
 * `legacy` (documents without `headRef`), 22 `reviewflow-test` (ignored); org
 * 2 (acme) does not allow tokens; the user's own account has no installation.
 */
const createApp = (tokenId: string, prs: ReviewflowPr[]) => {
  const repositories: Record<string, { _id: number; fullName: string }> = {
    "1/elax/api": { _id: 20, fullName: "elax/api" },
    "1/elax/legacy": { _id: 21, fullName: "elax/legacy" },
    "1/elax/reviewflow-test": { _id: 22, fullName: "elax/reviewflow-test" },
    "42/christophehurpeau/tool": {
      _id: 30,
      fullName: "christophehurpeau/tool",
    },
  };
  const repositoriesFindOne = vi.fn((criteria: Record<string, unknown>) => {
    const { "account.id": accountId, fullName } = criteria as {
      "account.id": number;
      fullName: { $regex: string; $options: string };
    };
    const regexp = new RegExp(fullName.$regex, fullName.$options);
    const found = Object.entries(repositories).find(
      ([key, { fullName: name }]) =>
        key.startsWith(`${accountId}/`) && regexp.test(name),
    );
    return Promise.resolve(found ? found[1] : null);
  });
  const matches = (pr: ReviewflowPr, criteria: Record<string, unknown>) =>
    pr.account.id === criteria["account.id"] &&
    pr.repo.id === criteria["repo.id"] &&
    (typeof criteria.headRef === "object"
      ? pr.headRef == null
      : pr.headRef === criteria.headRef);
  const prsFindAll = vi.fn((criteria: Record<string, unknown>) =>
    Promise.resolve(prs.filter((pr) => matches(pr, criteria))),
  );
  const prsFindOne = vi.fn((criteria: Record<string, unknown>) =>
    Promise.resolve(prs.find((pr) => matches(pr, criteria)) ?? null),
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
      findByKey: (id: number) =>
        Promise.resolve(id === 1 ? { _id: 1, installationId: 100 } : null),
    },
    users: {
      findByKey: () =>
        Promise.resolve({ _id: 42, paidFeatures: { enabled: true } }),
    },
    repositories: { findOne: repositoriesFindOne },
    prs: { findAll: prsFindAll, findOne: prsFindOne },
  } as unknown as MongoStores;

  const app = express();
  app.use(
    "/api",
    apiRouter({ mongoStores }, { getRelayState: liveRelayState }),
  );

  return { app, repositoriesFindOne, prsFindAll, prsFindOne };
};

const post = (app: express.Express, body: string, withToken = true) =>
  callApp(app, {
    method: "POST",
    url: "/api/prs-lookup/v1",
    headers: {
      "content-type": "application/json",
      "content-length": String(Buffer.byteLength(body)),
      ...(withToken ? { authorization: `Bearer ${plainToken}` } : {}),
    },
    body,
  });

const lookup = async (
  app: express.Express,
  targets: { ownerRepo: string; headRef: string }[],
) => {
  const response = await post(app, JSON.stringify({ targets }));
  return { response, json: JSON.parse(response.body) };
};

describe("POST /api/prs-lookup/v1", () => {
  it("answers in the order of the targets, the newest pull request of the head branch", async () => {
    const { app } = createApp("t-lk-ok", [
      createPr(10, "feat/a", "elax/api"),
      createPr(12, "feat/a", "elax/api"),
      createPr(11, "feat/a", "elax/api"),
      createPr(13, "feat/b", "elax/api"),
    ]);

    const { response, json } = await lookup(app, [
      { ownerRepo: "ELAX/api", headRef: "feat/b" },
      { ownerRepo: "elax/api", headRef: "feat/a" },
      { ownerRepo: "elax/api", headRef: "feat/none" },
      { ownerRepo: "acme/api", headRef: "feat/a" },
    ]);

    expect(response.status).toBe(200);
    expect(json.results).toHaveLength(4);
    expect(json.results[0]).toMatchObject({
      found: true,
      pr: { number: 13, ownerRepo: "elax/api" },
    });
    expect(json.results[1]).toMatchObject({ found: true, pr: { number: 12 } });
    expect(json.results[2]).toEqual({ found: false, reason: "noPr" });
    expect(json.results[3]).toEqual({ found: false, reason: "forbidden" });
    expect(json).not.toHaveProperty("cursor");
  });

  it("matches the head repository: a fork branch of the same name is not the repository's", async () => {
    const { app } = createApp("t-lk-fork", [
      createPr(20, "main", "someone/api"),
      createPr(15, "main", "elax/api"),
      createPr(30, "main", null),
      createPr(31, "main", undefined),
    ]);

    const { json } = await lookup(app, [
      { ownerRepo: "elax/api", headRef: "main" },
    ]);

    expect(json.results[0]).toMatchObject({ found: true, pr: { number: 15 } });
  });

  it("answers noPr when only forks pushed that branch", async () => {
    const { app } = createApp("t-lk-fork-only", [
      createPr(20, "main", "someone/api"),
    ]);

    const { json } = await lookup(app, [
      { ownerRepo: "elax/api", headRef: "main" },
    ]);

    expect(json.results[0]).toEqual({ found: false, reason: "noPr" });
  });

  it("answers notTracked for an unknown repository, an ignored one and an account without installation", async () => {
    // `reviewflow-test` is ignored except by the dev app
    vi.stubEnv("REVIEWFLOW_NAME", "reviewflow");
    const { app } = createApp("t-lk-untracked", []);

    const { json } = await lookup(app, [
      { ownerRepo: "elax/nope", headRef: "a" },
      { ownerRepo: "elax/reviewflow-test", headRef: "a" },
      { ownerRepo: "christophehurpeau/tool", headRef: "a" },
      { ownerRepo: "no-slash", headRef: "a" },
    ]);

    expect(json.results).toEqual([
      { found: false, reason: "notTracked" },
      { found: false, reason: "notTracked" },
      { found: false, reason: "notTracked" },
      { found: false, reason: "forbidden" },
    ]);
    vi.unstubAllEnvs();
  });

  it("answers notTracked, not noPr, while the repository has documents without headRef (D10)", async () => {
    const { app } = createApp("t-lk-d10", [
      createPr(1, undefined, undefined, 21),
      createPr(2, "feat/a", "elax/api", 20),
    ]);

    const { json } = await lookup(app, [
      { ownerRepo: "elax/legacy", headRef: "feat/x" },
      { ownerRepo: "elax/api", headRef: "feat/x" },
    ]);

    expect(json.results).toEqual([
      { found: false, reason: "notTracked" },
      { found: false, reason: "noPr" },
    ]);
  });

  it("resolves each distinct repository once, whatever the number of targets", async () => {
    const { app, repositoriesFindOne, prsFindOne } = createApp("t-lk-once", []);

    await lookup(app, [
      { ownerRepo: "elax/legacy", headRef: "a" },
      { ownerRepo: "ELAX/legacy", headRef: "b" },
      { ownerRepo: "elax/legacy", headRef: "c" },
      { ownerRepo: "elax/api", headRef: "a" },
    ]);

    expect(repositoriesFindOne).toHaveBeenCalledTimes(2);
    expect(prsFindOne).toHaveBeenCalledTimes(2);
  });

  it("looks nothing up for an owner the token cannot read", async () => {
    const { app, repositoriesFindOne, prsFindAll } = createApp("t-lk-403", []);

    await lookup(app, [{ ownerRepo: "acme/api", headRef: "a" }]);

    expect(repositoriesFindOne).not.toHaveBeenCalled();
    expect(prsFindAll).not.toHaveBeenCalled();
  });

  it("accepts an empty list and exactly 200 targets", async () => {
    const { app } = createApp("t-lk-limit", []);

    const empty = await lookup(app, []);
    const full = await lookup(
      app,
      Array.from({ length: 200 }, (_, i) => ({
        ownerRepo: "acme/api",
        headRef: `b${i}`,
      })),
    );

    expect(empty.json).toEqual({ results: [] });
    expect(full.json.results).toHaveLength(200);
  });

  it.each([
    ["invalid json", "{"],
    ["no body object", "[]"],
    ["targets not an array", JSON.stringify({ targets: "a" })],
    [
      "more than 200 targets",
      JSON.stringify({
        targets: Array.from({ length: 201 }, () => ({
          ownerRepo: "a/b",
          headRef: "c",
        })),
      }),
    ],
    ["a target not an object", JSON.stringify({ targets: ["a/b"] })],
    [
      "ownerRepo not a string",
      JSON.stringify({ targets: [{ ownerRepo: 1, headRef: "c" }] }),
    ],
    ["headRef missing", JSON.stringify({ targets: [{ ownerRepo: "a/b" }] })],
  ])("answers 400 for %s", async (_name, body) => {
    const { app } = createApp("t-lk-400", []);

    const response = await post(app, body);

    expect(response.status).toBe(400);
    expect(JSON.parse(response.body).error.code).toBe("badRequest");
  });

  it("requires a token, before reading the body", async () => {
    const { app } = createApp("t-lk-401", []);

    const response = await post(app, "{", false);

    expect(response.status).toBe(401);
  });
});
