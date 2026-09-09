import { describe, expect, it } from "vitest";
import type { ReviewersGroupedByState } from "../models/ReviewersGroupedByState.ts";
import {
  reviewedWithReviewer,
  reviewsAfterRequestingAgain,
} from "./reviewsAfterRequestingAgain.ts";

const chris = { id: 42, login: "chris" };
const decidedAt = new Date("2026-02-01T09:00:00Z");

const buildReviews = (
  overrides: Partial<ReviewersGroupedByState> = {},
): ReviewersGroupedByState => ({
  teamReviewRequested: [],
  reviewRequested: [],
  approved: [],
  changesRequested: [],
  dismissed: [],
  commented: [],
  reviewed: [],
  ...overrides,
});

describe("reviewsAfterRequestingAgain", () => {
  it("puts the reviewer back among the ones the pull request waits on", () => {
    const reviews = reviewsAfterRequestingAgain(buildReviews(), chris);

    expect(reviews.reviewRequested).toEqual([chris]);
    expect(reviews.reviewed).toEqual([chris]);
  });

  /** the whole point: a pull request must stop counting as approved by them */
  it("retires the decision they had reached", () => {
    const reviews = reviewsAfterRequestingAgain(
      buildReviews({
        approved: [chris, { id: 7, login: "dan" }],
        reviewed: [
          { ...chris, endedAt: decidedAt },
          { id: 7, login: "dan", endedAt: decidedAt },
        ],
      }),
      chris,
    );

    expect(reviews.approved).toEqual([{ id: 7, login: "dan" }]);
    expect(reviews.reviewRequested).toEqual([chris]);
    // both decisions stay recorded: asking again is not undoing them
    expect(reviews.reviewed).toEqual([
      { ...chris, endedAt: decidedAt },
      { id: 7, login: "dan", endedAt: decidedAt },
    ]);
  });

  it("retires a request for changes and a dismissal alike", () => {
    const reviews = reviewsAfterRequestingAgain(
      buildReviews({ changesRequested: [chris], dismissed: [chris] }),
      chris,
    );

    expect(reviews.changesRequested).toEqual([]);
    expect(reviews.dismissed).toEqual([]);
  });

  it("never lists the reviewer twice, however often it is asked", () => {
    const once = reviewsAfterRequestingAgain(buildReviews(), chris);
    const twice = reviewsAfterRequestingAgain(once, chris);

    expect(twice.reviewRequested).toEqual([chris]);
    expect(twice.reviewed).toEqual([chris]);
  });

  it("leaves everyone else, and the team request, alone", () => {
    const reviews = reviewsAfterRequestingAgain(
      buildReviews({
        teamReviewRequested: [{ id: 9, name: "dev" }],
        reviewRequested: [{ id: 7, login: "dan" }],
        commented: [{ id: 8, login: "erin" }],
      }),
      chris,
    );

    expect(reviews.teamReviewRequested).toEqual([{ id: 9, name: "dev" }]);
    expect(reviews.reviewRequested).toEqual([{ id: 7, login: "dan" }, chris]);
    expect(reviews.commented).toEqual([{ id: 8, login: "erin" }]);
  });

  /** documents written before these fields existed reach this without them */
  it("builds every group from a pull request that had none", () => {
    const reviews = reviewsAfterRequestingAgain(undefined, chris);

    expect(reviews).toEqual({
      teamReviewRequested: [],
      reviewRequested: [chris],
      approved: [],
      changesRequested: [],
      dismissed: [],
      commented: [],
      reviewed: [chris],
    });
  });
});

describe("reviewedWithReviewer", () => {
  /** a comment is not a decision, and does not undo the one they made */
  it("leaves the decision the reviewer had recorded", () => {
    const decided = [{ ...chris, endedAt: decidedAt }];

    expect(reviewedWithReviewer(decided, chris)).toEqual(decided);
  });

  it("records a reviewer who had none, keeping the others", () => {
    const dan = { id: 7, login: "dan", endedAt: decidedAt };

    expect(reviewedWithReviewer([dan], chris)).toEqual([dan, chris]);
  });

  it("starts the list on a pull request nobody reviewed", () => {
    expect(reviewedWithReviewer(undefined, chris)).toEqual([chris]);
  });
});
