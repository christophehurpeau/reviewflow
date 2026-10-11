import { describe, expect, it } from "vitest";
import {
  createEmptyReviews,
  groupReviewsState,
} from "./groupReviewsWithState.ts";

const chris = { id: 42, login: "chris", type: "User" };
const dan = { id: 7, login: "dan", type: "User" };
const requestedAt = new Date("2026-03-01T09:00:00Z");
const now = new Date("2026-03-02T09:00:00Z");

const requestedState = (...reviewers: (typeof chris)[]) => ({
  reviewersWithState: reviewers.map((reviewer) => ({
    ...reviewer,
    state: "REVIEW_REQUESTED" as const,
  })),
  requestedReviewers: reviewers,
  requestedTeam: [],
});

describe("groupReviewsState requestedAt", () => {
  it("dates the request the event is about", () => {
    const reviews = groupReviewsState(
      requestedState(chris),
      createEmptyReviews(),
      { reviewerId: chris.id, at: now },
    );

    expect(reviews.reviewRequested).toEqual([{ ...chris, requestedAt: now }]);
  });

  it("carries over the date of requests already pending", () => {
    const previous = {
      ...createEmptyReviews(),
      reviewRequested: [{ ...dan, requestedAt }],
    };

    const reviews = groupReviewsState(requestedState(dan, chris), previous, {
      reviewerId: chris.id,
      at: now,
    });

    expect(reviews.reviewRequested).toEqual([
      { ...dan, requestedAt },
      { ...chris, requestedAt: now },
    ]);
  });

  it("never invents a date for a request it did not see", () => {
    const reviews = groupReviewsState(requestedState(chris), undefined);

    expect(reviews.reviewRequested).toEqual([chris]);
    expect(reviews.reviewRequested[0]).not.toHaveProperty("requestedAt");
  });

  it("drops the date with a request that is no longer pending", () => {
    const previous = {
      ...createEmptyReviews(),
      reviewRequested: [{ ...chris, requestedAt }],
    };

    const reviews = groupReviewsState(
      {
        reviewersWithState: [{ ...chris, state: "APPROVED" }],
        requestedReviewers: [],
        requestedTeam: [],
      },
      previous,
    );

    expect(reviews.reviewRequested).toEqual([]);
    expect(reviews.approved).toEqual([chris]);
  });

  it("dates a request asked again over a review already submitted", () => {
    const submittedAt = new Date("2026-02-01T09:00:00Z");
    const reviews = groupReviewsState(
      {
        reviewersWithState: [
          {
            ...chris,
            state: "REVIEW_REQUESTED",
            review: { endedAt: submittedAt, submittedAt },
          },
        ],
        requestedReviewers: [chris],
        requestedTeam: [],
      },
      undefined,
      { reviewerId: chris.id, at: now },
    );

    expect(reviews.reviewRequested).toEqual([{ ...chris, requestedAt: now }]);
    expect(reviews.reviewed).toEqual([
      { id: 42, login: "chris", endedAt: submittedAt, submittedAt },
    ]);
  });
});
