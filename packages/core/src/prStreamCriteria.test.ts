import { describe, expect, it } from "vitest";
import { Query } from "mingo";
import { prBucketsInOrder } from "reviewflow-modules";
import {
  buildPrBucketQuery,
  buildPrStreamCriteria,
} from "./prBucketCriteria.ts";

const userId = 42;
const context = { userId, accounts: [{ accountId: 1, teams: [] }] };
const closedSince = new Date("2026-10-10T00:00:00Z");

const emptyReviews = {
  approved: [],
  changesRequested: [],
  commented: [],
  dismissed: [],
  reviewRequested: [],
  teamReviewRequested: [],
  reviewed: [],
};

const pr = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  account: { id: 1 },
  creator: { id: 7 },
  assignees: [],
  isClosed: false,
  isDraft: false,
  reviews: emptyReviews,
  ...overrides,
});

const me = { id: userId, login: "me" };

const samples = {
  authoredOpen: pr({ creator: me }),
  assignedDraft: pr({ assignees: [me], isDraft: true }),
  reviewRequested: pr({ reviews: { ...emptyReviews, reviewRequested: [me] } }),
  reviewRequestedAgain: pr({
    reviews: { ...emptyReviews, reviewRequested: [me], reviewed: [me] },
  }),
  approvedAndRequested: pr({
    creator: me,
    reviews: {
      ...emptyReviews,
      approved: [{ id: 3 }],
      reviewRequested: [{ id: 4 }],
    },
  }),
  someoneElses: pr(),
  otherAccount: pr({ account: { id: 2 }, creator: me }),
  closedRecently: pr({
    creator: me,
    isClosed: true,
    flowDates: { closedAt: new Date("2026-10-12T00:00:00Z") },
  }),
  closedLongAgo: pr({
    creator: me,
    isClosed: true,
    flowDates: { closedAt: new Date("2026-09-01T00:00:00Z") },
  }),
};

const matches = (criteria: unknown, doc: Record<string, unknown>): boolean =>
  new Query(criteria as Record<string, unknown>).test(doc);

describe("buildPrStreamCriteria", () => {
  const openScope = buildPrStreamCriteria(context);
  const withClosed = buildPrStreamCriteria(context, { closedSince });

  it("holds every pull request of every board bucket", () => {
    for (const doc of Object.values(samples)) {
      const onBoard = prBucketsInOrder.some((bucket) =>
        matches(buildPrBucketQuery(bucket, context).criteria, doc),
      );
      if (onBoard) expect(matches(openScope, doc)).toBe(true);
    }
  });

  it("holds the open pull requests the user owns, whatever their bucket", () => {
    expect(matches(openScope, samples.authoredOpen)).toBe(true);
    expect(matches(openScope, samples.assignedDraft)).toBe(true);
    expect(matches(openScope, samples.approvedAndRequested)).toBe(true);
    expect(matches(openScope, samples.reviewRequested)).toBe(true);
    expect(matches(openScope, samples.reviewRequestedAgain)).toBe(true);
  });

  it("leaves out other people's pull requests and unread accounts", () => {
    expect(matches(openScope, samples.someoneElses)).toBe(false);
    expect(matches(openScope, samples.otherAccount)).toBe(false);
  });

  it("holds no closed pull request without `closedSince`", () => {
    expect(matches(openScope, samples.closedRecently)).toBe(false);
  });

  it("holds the owned pull requests closed since `closedSince`", () => {
    expect(matches(withClosed, samples.closedRecently)).toBe(true);
    expect(matches(withClosed, samples.closedLongAgo)).toBe(false);
    expect(
      matches(withClosed, { ...samples.closedRecently, creator: { id: 7 } }),
    ).toBe(false);
  });
});
