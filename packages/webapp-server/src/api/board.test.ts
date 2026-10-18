import { describe, expect, it, vi } from "vitest";
import express from "express";
import type { MongoStores, PersonalToken, ReviewflowPr } from "reviewflow-core";
import { buildPrBucketQuery } from "reviewflow-core";
import { prBucketsInOrder } from "reviewflow-modules";
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

const createPr = (number: number): ReviewflowPr =>
  ({
    _id: `pr-${number}`,
    account: { id: 1, login: "elax", type: "Organization" },
    repo: { id: 20, name: "api" },
    pr: { number },
    commentId: 1,
    title: `pr ${number}`,
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
  }) as unknown as ReviewflowPr;

interface Call {
  criteria: Record<string, unknown>;
  sort: Record<string, unknown>;
  skipped: number;
  limit: number;
}

/**
 * Member of org 1 (allows tokens) and org 2 (does not). `requested-reviews`
 * holds `requestedTotal` pull requests, every other bucket none.
 */
const createApp = (tokenId: string, requestedTotal = 2) => {
  const calls: Call[] = [];
  const counts: Record<string, unknown>[] = [];

  /** only `requested-reviews` asks for a review not yet answered */
  const isRequested = (criteria: Record<string, unknown>) =>
    JSON.stringify(criteria["reviews.reviewed.id"]) ===
    JSON.stringify({ $ne: 42 });

  const createQueryCollection = vi.fn(
    ({
      criteria,
      sort,
      skip,
      limit,
    }: {
      criteria: Record<string, unknown>;
      sort: Record<string, unknown>;
      skip: number;
      limit: number;
    }) => {
      calls.push({ criteria, sort, skipped: skip, limit });
      const prs = isRequested(criteria)
        ? Array.from(
            { length: Math.max(0, Math.min(limit, requestedTotal - skip)) },
            (_, index) => createPr(skip + index + 1),
          )
        : [];
      return {
        fetch: <T>(onFulfilled: (result: { result: ReviewflowPr[] }) => T) =>
          Promise.resolve(onFulfilled({ result: prs })),
      };
    },
  );
  const count = vi.fn((criteria: Record<string, unknown>) => {
    counts.push(criteria);
    return Promise.resolve(isRequested(criteria) ? requestedTotal : 0);
  });

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
          { _id: 1, login: "elax", config: { allowPersonalTokens: true } },
          { _id: 2, login: "acme", config: {} },
        ]),
    },
    prs: { createQueryCollection, count },
  } as unknown as MongoStores;

  const app = express();
  app.use(
    "/api",
    apiRouter({ mongoStores }, { getRelayState: liveRelayState }),
  );

  return { app, calls, counts };
};

const get = (app: express.Express, url: string) =>
  callApp(app, {
    method: "GET",
    url,
    headers: { authorization: `Bearer ${plainToken}` },
  });

const errorOf = (body: string) =>
  (JSON.parse(body) as { error: { code: string } }).error.code;

describe("GET /api/board/v1", () => {
  it("returns the groups and buckets in display order, without a cursor", async () => {
    const { app } = createApp("t-board-order");

    const response = await get(app, "/api/board/v1");

    expect(response.status).toBe(200);
    const body = JSON.parse(response.body) as {
      groups: {
        key: string;
        title: string;
        buckets: { key: string; title: string; total: number }[];
      }[];
    };
    expect(Object.keys(body)).toEqual(["groups"]);
    expect(body.groups.map(({ key, title }) => ({ key, title }))).toEqual([
      { key: "requesting-attention", title: "PRs requesting your attention" },
      { key: "in-progress", title: "Your PRs in progress" },
    ]);
    expect(
      body.groups.flatMap(({ buckets }) => buckets.map((b) => b.key)),
    ).toEqual(prBucketsInOrder);
    expect(body.groups[0]!.buckets[1]).toMatchObject({
      key: "requested-reviews",
      title: "Requested reviews",
      total: 2,
      nextPage: null,
    });
  });

  it("serves pull request details computed for the reader", async () => {
    const { app } = createApp("t-board-detail");

    const response = await get(app, "/api/board/v1");

    const body = JSON.parse(response.body) as {
      groups: { buckets: { key: string; prs: Record<string, unknown>[] }[] }[];
    };
    const requested = body.groups[0]!.buckets.find(
      ({ key }) => key === "requested-reviews",
    )!;
    expect(requested.prs.map((pr) => pr.number)).toEqual([1, 2]);
    expect(requested.prs[0]).toMatchObject({
      _id: "pr-1",
      myBuckets: ["requested-reviews"],
    });
  });

  const expectedCriteria = (accounts: { accountId: number }[]) =>
    prBucketsInOrder.map(
      (bucket) =>
        buildPrBucketQuery(bucket, {
          userId: 42,
          accounts: accounts.map(({ accountId }) => ({ accountId, teams: [] })),
        }).criteria,
    );

  it("spans the readable accounts only when `account` is omitted", async () => {
    const { app, counts } = createApp("t-board-all");

    await get(app, "/api/board/v1");

    // the user's own account and org 1: org 2 does not allow tokens
    expect(counts).toEqual(
      expect.arrayContaining(
        expectedCriteria([{ accountId: 42 }, { accountId: 1 }]),
      ),
    );
    expect(counts).toHaveLength(prBucketsInOrder.length);
  });

  it("scopes the board to one account, case-insensitively", async () => {
    const { app, counts } = createApp("t-board-one");

    const response = await get(app, "/api/board/v1?account=ELAX");

    expect(response.status).toBe(200);
    expect(counts).toEqual(
      expect.arrayContaining(expectedCriteria([{ accountId: 1 }])),
    );
    expect(counts).toHaveLength(prBucketsInOrder.length);
  });

  it("uses the bucket criteria and sort of the webapp board", async () => {
    const { app, calls } = createApp("t-board-shared");

    await get(app, "/api/board/v1?account=elax");

    const expected = buildPrBucketQuery("drafts", {
      userId: 42,
      accounts: [{ accountId: 1, teams: [] }],
    });
    const drafts = calls.find(
      ({ criteria }) =>
        JSON.stringify(criteria) === JSON.stringify(expected.criteria),
    );
    expect(drafts?.sort).toEqual({ ...expected.sort, _id: -1 });
    expect(drafts?.limit).toBe(100);
  });

  it("answers 403 for an organization that does not allow tokens, or an unknown account", async () => {
    const { app, calls } = createApp("t-board-403");

    const notAllowed = await get(app, "/api/board/v1?account=acme");
    const unknown = await get(app, "/api/board/v1?account=stranger");

    expect(notAllowed.status).toBe(403);
    expect(unknown.status).toBe(403);
    expect(notAllowed.body).toBe(unknown.body);
    expect(calls).toEqual([]);
  });

  it("answers 400 for a repeated or empty `account`", async () => {
    const { app } = createApp("t-board-400");

    for (const query of ["account=a&account=b", "account="]) {
      const response = await get(app, `/api/board/v1?${query}`);
      expect(response.status, query).toBe(400);
      expect(errorOf(response.body)).toBe("badRequest");
    }
  });

  it("requires a token", async () => {
    const { app } = createApp("t-board-401");

    const response = await callApp(app, {
      method: "GET",
      url: "/api/board/v1",
    });

    expect(response.status).toBe(401);
  });
});

describe("GET /api/board-bucket/v1", () => {
  const bucketUrl = (query: string) => `/api/board-bucket/v1?${query}`;

  it("returns the first page of a bucket", async () => {
    const { app } = createApp("t-bucket-first");

    const response = await get(app, bucketUrl("bucket=requested-reviews"));

    expect(response.status).toBe(200);
    const body = JSON.parse(response.body) as {
      key: string;
      total: number;
      prs: unknown[];
      nextPage: string | null;
    };
    expect(body).toMatchObject({
      key: "requested-reviews",
      title: "Requested reviews",
      total: 2,
      nextPage: null,
    });
    expect(body.prs).toHaveLength(2);
  });

  it("pages past the first 100 with the opaque `nextPage`", async () => {
    const { app } = createApp("t-bucket-pages", 250);
    interface Page {
      total: number;
      prs: { number: number }[];
      nextPage: string | null;
    }
    const getPage = async (page?: string): Promise<Page> => {
      const response = await get(
        app,
        bucketUrl(
          `bucket=requested-reviews${page === undefined ? "" : `&page=${page}`}`,
        ),
      );
      return JSON.parse(response.body) as Page;
    };

    const first = await getPage();
    expect(first.total).toBe(250);
    expect(first.prs).toHaveLength(100);
    expect(typeof first.nextPage).toBe("string");

    const second = await getPage(first.nextPage!);
    expect(second.prs[0]!.number).toBe(101);
    expect(second.prs).toHaveLength(100);

    const third = await getPage(second.nextPage!);
    expect(third.prs).toHaveLength(50);
    expect(third.nextPage).toBeNull();
  });

  it("scopes to `account` and answers 403 for one the token cannot read", async () => {
    const { app } = createApp("t-bucket-account");

    const ok = await get(app, bucketUrl("bucket=drafts&account=elax"));
    const forbidden = await get(app, bucketUrl("bucket=drafts&account=acme"));

    expect(ok.status).toBe(200);
    expect(forbidden.status).toBe(403);
  });

  it("answers 400 for a missing or unknown bucket", async () => {
    const { app } = createApp("t-bucket-400");

    for (const query of ["", "bucket=nope", "bucket=constructor", "bucket="]) {
      const response = await get(app, bucketUrl(query));
      expect(response.status, query).toBe(400);
      expect(errorOf(response.body)).toBe("badRequest");
    }
  });

  it("answers 400 for a page that is not a token of this API", async () => {
    const { app, calls } = createApp("t-bucket-bad-page");
    const valid = Buffer.from("offset:100").toString("base64url");

    for (const page of [
      "2",
      "abc",
      Buffer.from("offset:0").toString("base64url"),
      Buffer.from("offset:-1").toString("base64url"),
      Buffer.from("offset:100x").toString("base64url"),
      Buffer.from("offset:99999999").toString("base64url"),
      `${valid}=`,
    ]) {
      const response = await get(app, bucketUrl(`bucket=drafts&page=${page}`));
      expect(response.status, page).toBe(400);
    }
    expect(calls).toEqual([]);
  });
});
