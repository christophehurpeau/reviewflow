import { describe, expect, it } from "vitest";
import { getReviewsState } from "./reviews.ts";

interface FakeReview {
  user: { id: number; login: string; type?: string };
  state: string;
  submitted_at: string;
}

const review = (
  id: number,
  login: string,
  state: string,
  submittedAt: string,
): FakeReview => ({ user: { id, login }, state, submitted_at: submittedAt });

/** the paginate contract: the mapper is handed one page and its results joined */
const buildContext = (reviews: FakeReview[]): any => ({
  octokit: {
    rest: { pulls: { listReviews: () => undefined } },
    paginate: (
      _fn: unknown,
      _params: unknown,
      mapFn: (page: { data: FakeReview[] }) => unknown[],
    ) => Promise.resolve(mapFn({ data: reviews })),
  },
  repo: (params: Record<string, unknown>) => params,
});

const pullRequest = (
  requestedReviewers: { id: number; login: string }[] = [],
): any => ({
  number: 1,
  requested_reviewers: requestedReviewers,
  requested_teams: [],
});

const reviewedOf = async (reviews: FakeReview[], requested = []) => {
  const state = await getReviewsState(
    buildContext(reviews),
    pullRequest(requested),
  );
  return state.reviewersWithState
    .filter(({ review: submitted }) => submitted !== undefined)
    .map(({ id, login, review: submitted }) => ({ id, login, ...submitted }));
};

describe("getReviewsState reviewed", () => {
  it("records a reviewer who only commented, with no decision", async () => {
    await expect(
      reviewedOf([review(42, "chris", "COMMENTED", "2026-03-01T09:00:00Z")]),
    ).resolves.toEqual([{ id: 42, login: "chris", endedAt: undefined }]);
  });

  it("dates the decision that closed the review", async () => {
    await expect(
      reviewedOf([
        review(42, "chris", "COMMENTED", "2026-03-01T09:00:00Z"),
        review(42, "chris", "APPROVED", "2026-03-01T11:00:00Z"),
      ]),
    ).resolves.toEqual([
      {
        id: 42,
        login: "chris",
        endedAt: new Date("2026-03-01T11:00:00Z"),
      },
    ]);
  });

  /** nothing says a reviewer must comment before deciding */
  it("dates a lone decision all the same", async () => {
    await expect(
      reviewedOf([
        review(42, "chris", "CHANGES_REQUESTED", "2026-03-01T09:00:00Z"),
      ]),
    ).resolves.toEqual([
      { id: 42, login: "chris", endedAt: new Date("2026-03-01T09:00:00Z") },
    ]);
  });

  /** commenting again is not deciding again: the decision still happened */
  it("keeps the decision date through a later comment", async () => {
    await expect(
      reviewedOf([
        review(42, "chris", "APPROVED", "2026-03-01T11:00:00Z"),
        review(42, "chris", "COMMENTED", "2026-03-05T08:00:00Z"),
      ]),
    ).resolves.toEqual([
      { id: 42, login: "chris", endedAt: new Date("2026-03-01T11:00:00Z") },
    ]);
  });

  it("keeps only the latest of several decisions", async () => {
    await expect(
      reviewedOf([
        review(42, "chris", "CHANGES_REQUESTED", "2026-03-01T11:00:00Z"),
        review(42, "chris", "APPROVED", "2026-03-05T08:00:00Z"),
      ]),
    ).resolves.toEqual([
      { id: 42, login: "chris", endedAt: new Date("2026-03-05T08:00:00Z") },
    ]);
  });

  it("records each reviewer on their own", async () => {
    await expect(
      reviewedOf([
        review(42, "chris", "COMMENTED", "2026-03-01T09:00:00Z"),
        review(7, "dan", "APPROVED", "2026-03-02T09:00:00Z"),
      ]),
    ).resolves.toEqual([
      { id: 42, login: "chris", endedAt: undefined },
      { id: 7, login: "dan", endedAt: new Date("2026-03-02T09:00:00Z") },
    ]);
  });

  /** being asked is not reviewing: only submitted reviews count */
  it("records nobody who was only asked for a review", async () => {
    await expect(
      reviewedOf([], [{ id: 42, login: "chris" }] as any),
    ).resolves.toEqual([]);
  });

  /** the reason it travels with the state: a request overrides that state */
  it("keeps the review of a reviewer asked again", async () => {
    const state = await getReviewsState(
      buildContext([review(42, "chris", "APPROVED", "2026-03-01T09:00:00Z")]),
      pullRequest([{ id: 42, login: "chris" }]),
    );

    expect(state.reviewersWithState).toEqual([
      {
        id: 42,
        login: "chris",
        type: undefined,
        state: "REVIEW_REQUESTED",
        review: { endedAt: new Date("2026-03-01T09:00:00Z") },
      },
    ]);
  });
});
