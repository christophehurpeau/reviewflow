import type { ReviewersGroupedByState } from "reviewflow-core";
import type {
  ReviewerWithState,
  ReviewsState,
} from "../../../utils/github/pullRequest/reviews";

const getKeyFromState = (
  state: ReviewerWithState["state"],
): Exclude<
  keyof ReviewersGroupedByState,
  "reviewed" | "teamReviewRequested"
> => {
  if (!state) return "commented";
  switch (state) {
    case "REVIEW_REQUESTED":
      return "reviewRequested";
    case "APPROVED":
      return "approved";
    case "CHANGES_REQUESTED":
      return "changesRequested";
    case "DISMISSED":
      return "dismissed";
    default:
      throw new Error(`Unexpected state: ${state as string}`);
  }
};
export function createEmptyReviews(): ReviewersGroupedByState {
  return {
    teamReviewRequested: [],
    reviewRequested: [],
    approved: [],
    changesRequested: [],
    dismissed: [],
    commented: [],
    reviewed: [],
  };
}

/**
 * `previous` carries over what github cannot return: when a pending request
 * was received. `requestedNow` is the request the event being handled is about.
 * A request that is no longer pending takes its date with it.
 */
export function groupReviewsState(
  reviewsState: ReviewsState,
  previous: ReviewersGroupedByState | undefined,
  requestedNow?: { reviewerId: number; at: Date },
): ReviewersGroupedByState {
  const reviews: ReviewersGroupedByState = createEmptyReviews();

  reviewsState.reviewersWithState.forEach(({ state, review, ...reviewer }) => {
    if (state === "REVIEW_REQUESTED") {
      const requestedAt =
        requestedNow?.reviewerId === reviewer.id
          ? requestedNow.at
          : previous?.reviewRequested?.find(({ id }) => id === reviewer.id)
              ?.requestedAt;
      reviews.reviewRequested.push(
        requestedAt ? { ...reviewer, requestedAt } : reviewer,
      );
    } else {
      reviews[getKeyFromState(state)].push(reviewer);
    }
    // a request replaces the state a reviewer had reached, so the fact that
    // they reviewed is recorded apart from the group they end up in
    if (review) {
      reviews.reviewed!.push({
        id: reviewer.id,
        login: reviewer.login,
        ...review,
      });
    }
  });

  reviews.teamReviewRequested = reviewsState.requestedTeam;

  return reviews;
}
