import type { ReviewersGroupedByState } from "reviewflow-core";
import type {
  ReviewerWithState,
  ReviewsState,
} from "../../../utils/github/pullRequest/reviews";

const getKeyFromState = (
  state: ReviewerWithState["state"],
): Exclude<keyof ReviewersGroupedByState, "teamReviewRequested"> => {
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
  };
}

export function groupReviewsState(
  reviewsState: ReviewsState,
): ReviewersGroupedByState {
  const reviews: ReviewersGroupedByState = createEmptyReviews();

  reviewsState.reviewersWithState.forEach(({ state, ...reviewer }) => {
    reviews[getKeyFromState(state)].push(reviewer);
  });

  reviews.teamReviewRequested = reviewsState.requestedTeam;

  return reviews;
}
