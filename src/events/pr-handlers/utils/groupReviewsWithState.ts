import type { ReviewerWithState } from '../../../utils/github/pullRequest/reviews';
import type { Reviewer } from './getReviewersAndReviewStates';

export interface ReviewersGroupedByState {
  reviewRequested: Reviewer[];
  approved: Reviewer[];
  changesRequested: Reviewer[];
  dismissed: Reviewer[];
  commented: Reviewer[];
}

const getKeyFromState = (
  state: ReviewerWithState['state'],
): keyof ReviewersGroupedByState => {
  if (!state) return 'commented';
  switch (state) {
    case 'REVIEW_REQUESTED':
      return 'reviewRequested';
    case 'APPROVED':
      return 'approved';
    case 'CHANGES_REQUESTED':
      return 'changesRequested';
    case 'DISMISSED':
      return 'dismissed';
  }

  throw new Error(`Unexpected state: ${state as string}`);
};
export function createEmptyReviews(): ReviewersGroupedByState {
  return {
    reviewRequested: [],
    approved: [],
    changesRequested: [],
    dismissed: [],
    commented: [],
  };
}

export function groupReviewsWithState(
  reviewersWithState: ReviewerWithState[],
): ReviewersGroupedByState {
  const reviews: ReviewersGroupedByState = createEmptyReviews();

  reviewersWithState.forEach(({ state, ...reviewer }) => {
    reviews[getKeyFromState(state)].push(reviewer);
  });

  return reviews;
}
