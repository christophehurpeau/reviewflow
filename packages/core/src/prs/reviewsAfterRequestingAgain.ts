import type { AccountInfo } from "../models/AccountInfo.ts";
import type { ReviewerReview } from "../models/ReviewerReview.ts";
import type { ReviewersGroupedByState } from "../models/ReviewersGroupedByState.ts";

const withoutUser = (
  reviewers: AccountInfo[] | undefined,
  id: number,
): AccountInfo[] => (reviewers ?? []).filter((reviewer) => reviewer.id !== id);

/**
 * The reviewer recorded as having reviewed this pull request. The date of the
 * decision they had reached is left alone: commenting again does not undo when
 * they last decided.
 */
export const reviewedWithReviewer = (
  reviewed: ReviewerReview[] | undefined,
  { id, login }: AccountInfo,
): ReviewerReview[] => {
  const current = reviewed ?? [];
  return current.some((review) => review.id === id)
    ? current
    : [...current, { id, login }];
};

/**
 * The state github holds once a reviewer commented on a pull request and their
 * review was asked again: the request takes whatever decision they had reached
 * out of the count, an approval included, and puts them back among the
 * reviewers the pull request waits on. When they reached it stays recorded.
 *
 * Written here rather than waited for: the webhook server recomputes the same
 * thing moments later, but its write reaches no subscription of the webapp
 * server, so a screen would not move until it refetched.
 */
export const reviewsAfterRequestingAgain = (
  reviews: ReviewersGroupedByState | undefined,
  user: AccountInfo,
): ReviewersGroupedByState => ({
  teamReviewRequested: reviews?.teamReviewRequested ?? [],
  reviewRequested: [...withoutUser(reviews?.reviewRequested, user.id), user],
  approved: withoutUser(reviews?.approved, user.id),
  changesRequested: withoutUser(reviews?.changesRequested, user.id),
  dismissed: withoutUser(reviews?.dismissed, user.id),
  commented: withoutUser(reviews?.commented, user.id),
  reviewed: reviewedWithReviewer(reviews?.reviewed, user),
});
