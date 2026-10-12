import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrBucket } from "reviewflow-modules";
import { prBucketsInOrder } from "reviewflow-modules";
import type { ReviewflowPr } from "../mongo.ts";
import type { PrBucketContext } from "../prBucketCriteria.ts";
import { buildPrBucketQuery } from "../prBucketCriteria.ts";
import type { TestMongoStores } from "../tests/testMongoStores.ts";
import { createTestMongoStores } from "../tests/testMongoStores.ts";
import { createToPrDetail } from "./toPrDetail.ts";

const viewerId = 42;
const viewer: PrBucketContext = {
  userId: viewerId,
  accounts: [{ accountId: 1, teams: [{ id: 9, name: "Web", slug: "web" }] }],
};

const emptyReviews = (): ReviewflowPr["reviews"] => ({
  approved: [],
  changesRequested: [],
  commented: [],
  dismissed: [],
  reviewRequested: [],
  teamReviewRequested: [],
  reviewed: [],
});

const buildPr = (overrides: Partial<ReviewflowPr> = {}): ReviewflowPr => ({
  _id: "pr-id",
  account: { id: 1, login: "acme", type: "Organization" },
  repo: { id: 2, name: "api" },
  pr: { number: 412 },
  commentId: 1,
  title: "feat: add the read api",
  isDraft: false,
  isClosed: false,
  reviews: emptyReviews(),
  assignees: [],
  created: new Date("2026-10-01T09:00:00Z"),
  updated: new Date("2026-10-02T10:00:00Z"),
  ...overrides,
});

const toPrDetail = createToPrDetail(viewer);

describe("identity and branches", () => {
  it("names the repository as owner/name", () => {
    expect(toPrDetail(buildPr())).toMatchObject({
      _id: "pr-id",
      accountId: 1,
      repoId: 2,
      ownerRepo: "acme/api",
      number: 412,
      url: "https://github.com/acme/api/pull/412",
    });
  });

  it("answers null for what an old document does not hold", () => {
    expect(toPrDetail(buildPr())).toMatchObject({
      headRef: null,
      baseRef: null,
      headSha: null,
      headRepoFullName: null,
      reviewState: null,
      unresolvedThreads: null,
      mergeable: "unknown",
      flowDates: {
        createdAt: null,
        openedAt: null,
        readyAt: null,
        reviewStartedAt: null,
        approvedAt: null,
        closedAt: null,
        lastPushedAt: null,
        lastReviewSubmittedAt: null,
      },
    });
  });

  it("keeps the branches and dates it holds, as iso strings", () => {
    const detail = toPrDetail(
      buildPr({
        headRef: "feat/read-api",
        baseRef: "main",
        headSha: "abc123",
        headRepoFullName: "acme/api",
        reviewState: "requested",
        flowDates: {
          createdAt: new Date("2026-10-01T09:00:00Z"),
          openedAt: new Date("2026-10-01T09:05:00Z"),
          lastPushedAt: new Date("2026-10-02T08:00:00Z"),
        },
      }),
    );

    expect(detail).toMatchObject({
      headRef: "feat/read-api",
      baseRef: "main",
      headSha: "abc123",
      headRepoFullName: "acme/api",
      reviewState: "requested",
      updatedAt: "2026-10-02T10:00:00.000Z",
    });
    expect(detail.flowDates).toMatchObject({
      createdAt: "2026-10-01T09:00:00.000Z",
      openedAt: "2026-10-01T09:05:00.000Z",
      lastPushedAt: "2026-10-02T08:00:00.000Z",
      closedAt: null,
    });
  });

  it("does not carry the flat dates of the summary", () => {
    const detail = toPrDetail(
      buildPr({
        flowDates: {
          createdAt: new Date("2026-10-01T09:00:00Z"),
          openedAt: new Date("2026-10-01T09:05:00Z"),
        },
      }),
    );

    expect(detail).not.toHaveProperty("openedAt");
    expect(detail).not.toHaveProperty("approvedAt");
  });
});

describe("mergeable", () => {
  it("reads the stored value", () => {
    expect(toPrDetail(buildPr({ mergeable: "conflicting" })).mergeable).toBe(
      "conflicting",
    );
  });
});

describe("state", () => {
  it.each([
    [{ isClosed: false, isDraft: false }, "open"],
    [{ isClosed: false, isDraft: true }, "draft"],
    [{ isClosed: true, isMerged: true }, "merged"],
    [{ isClosed: true, isMerged: false }, "closed"],
    [{ isClosed: true }, null],
  ] as const)("maps %j to %j", (fields, state) => {
    expect(toPrDetail(buildPr(fields)).state).toBe(state);
  });
});

describe("reviewers", () => {
  it("lists each person with their state and dates, the author left out", () => {
    const detail = toPrDetail(
      buildPr({
        creator: { id: 7, login: "author" },
        reviews: {
          ...emptyReviews(),
          reviewRequested: [
            {
              id: 10,
              login: "first",
              requestedAt: new Date("2026-10-02T08:00:00Z"),
            },
            { id: 11, login: "again" },
          ],
          approved: [{ id: 12, login: "approver" }],
          changesRequested: [{ id: 13, login: "blocker" }],
          commented: [
            { id: 14, login: "commenter" },
            { id: 7, login: "author" },
          ],
          dismissed: [{ id: 15, login: "dismissed" }],
          reviewed: [
            {
              id: 11,
              login: "again",
              submittedAt: new Date("2026-10-01T12:00:00Z"),
            },
            {
              id: 12,
              login: "approver",
              submittedAt: new Date("2026-10-02T09:00:00Z"),
            },
            {
              id: 7,
              login: "author",
              submittedAt: new Date("2026-10-02T09:30:00Z"),
            },
          ],
        },
      }),
    );

    expect(detail.reviewers).toEqual([
      {
        id: 10,
        login: "first",
        state: "requested",
        submittedAt: null,
        requestedAt: "2026-10-02T08:00:00.000Z",
      },
      {
        id: 11,
        login: "again",
        state: "reRequested",
        submittedAt: "2026-10-01T12:00:00.000Z",
        requestedAt: null,
      },
      {
        id: 12,
        login: "approver",
        state: "approved",
        submittedAt: "2026-10-02T09:00:00.000Z",
        requestedAt: null,
      },
      {
        id: 13,
        login: "blocker",
        state: "changesRequested",
        submittedAt: null,
        requestedAt: null,
      },
      {
        id: 14,
        login: "commenter",
        state: "commented",
        submittedAt: null,
        requestedAt: null,
      },
      {
        id: 15,
        login: "dismissed",
        state: "dismissed",
        submittedAt: null,
        requestedAt: null,
      },
    ]);
  });
});

describe("checks", () => {
  it("counts passed, failed and pending with reviewflow's rules", () => {
    const detail = toPrDetail(
      buildPr({
        checksConclusion: {
          a: { name: "build", conclusion: "success" },
          b: { name: "lint", conclusion: "skipped" },
          c: { name: "test", conclusion: "failure" },
          d: { name: "e2e", conclusion: null },
          e: { name: "codecov/patch", conclusion: null },
          f: { name: "ci/hold-deploy", conclusion: "failure" },
        },
        statusesConclusion: {
          g: { context: "ci/legacy", state: "success" },
          h: { context: "ci/deploy", state: "pending" },
        },
      }),
    );

    expect(detail.checks).toEqual({
      conclusion: "failed",
      runningCount: 2,
      failedNames: ["test"],
      passed: 3,
      failed: 1,
      pending: 2,
    });
  });
});

/**
 * `myBuckets` evaluates the board criteria in memory: this checks the
 * evaluation agrees with mongo running the same criteria, over documents
 * reaching every bucket.
 */
describe("myBuckets agrees with mongo", () => {
  let stores: TestMongoStores;

  const documents: ReviewflowPr[] = [
    buildPr({ _id: "nobody", creator: { id: 7, login: "author" } }),
    buildPr({
      _id: "mine-missing-request",
      creator: { id: viewerId, login: "me" },
    }),
    buildPr({
      _id: "mine-draft",
      isDraft: true,
      creator: { id: viewerId, login: "me" },
    }),
    buildPr({
      _id: "mine-assigned-waiting",
      creator: { id: 7, login: "author" },
      assignees: [{ id: viewerId, login: "me" }],
      reviews: {
        ...emptyReviews(),
        reviewRequested: [{ id: 8, login: "other" }],
      },
    }),
    buildPr({
      _id: "mine-ready",
      creator: { id: viewerId, login: "me" },
      reviews: { ...emptyReviews(), approved: [{ id: 8, login: "other" }] },
    }),
    buildPr({
      _id: "mine-changes",
      creator: { id: viewerId, login: "me" },
      reviews: {
        ...emptyReviews(),
        changesRequested: [{ id: 8, login: "other" }],
      },
    }),
    buildPr({
      _id: "asked-of-me",
      creator: { id: 7, login: "author" },
      reviews: {
        ...emptyReviews(),
        reviewRequested: [{ id: viewerId, login: "me" }],
      },
    }),
    buildPr({
      _id: "asked-of-my-team",
      creator: { id: 7, login: "author" },
      reviews: {
        ...emptyReviews(),
        teamReviewRequested: [{ id: 9, name: "Web" }],
      },
    }),
    buildPr({
      _id: "asked-of-me-again",
      creator: { id: 7, login: "author" },
      reviews: {
        ...emptyReviews(),
        reviewRequested: [{ id: viewerId, login: "me" }],
        reviewed: [{ id: viewerId, login: "me" }],
      },
    }),
    buildPr({
      _id: "other-account",
      account: { id: 3, login: "globex", type: "Organization" },
      creator: { id: viewerId, login: "me" },
    }),
    buildPr({
      _id: "mine-closed",
      isClosed: true,
      isMerged: true,
      creator: { id: viewerId, login: "me" },
    }),
  ];

  beforeAll(async () => {
    stores = await createTestMongoStores();
    // one number each: (account, repo, number) is unique
    const numbered = documents.map((pr, index) => ({
      ...pr,
      pr: { number: index + 1 },
    }));
    await stores.db
      .collection("prs")
      .insertMany(numbered as unknown as Record<string, unknown>[]);
  });

  afterAll(async () => {
    await stores.dispose();
  });

  it.each(prBucketsInOrder)(
    "matches mongo for %s",
    async (bucket: PrBucket) => {
      const { criteria } = buildPrBucketQuery(bucket, viewer);
      const fromMongo = await stores.prs.findAll(criteria);

      const fromDetail = documents
        .filter((pr) => toPrDetail(pr).myBuckets.includes(bucket))
        .map((pr) => pr._id);

      expect(fromDetail.toSorted()).toEqual(
        fromMongo.map((pr) => pr._id).toSorted(),
      );
    },
  );

  it("puts each fixture on the expected buckets", () => {
    const bucketsOf = (id: string) =>
      toPrDetail(documents.find((pr) => pr._id === id)!).myBuckets;

    expect(bucketsOf("nobody")).toEqual([]);
    expect(bucketsOf("asked-of-me")).toEqual(["requested-reviews"]);
    expect(bucketsOf("asked-of-my-team")).toEqual(["requested-reviews"]);
    expect(bucketsOf("asked-of-me-again")).toEqual(["re-requested-reviews"]);
    expect(bucketsOf("mine-ready")).toEqual(["ready-to-merge"]);
    expect(bucketsOf("mine-draft")).toEqual(["drafts"]);
    expect(bucketsOf("other-account")).toEqual([]);
    expect(bucketsOf("mine-closed")).toEqual([]);
  });
});
