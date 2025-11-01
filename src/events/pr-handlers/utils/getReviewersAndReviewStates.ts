import type { EmitterWebhookEventName } from "@octokit/webhooks";
import type { AccountInfo } from "../../../context/getOrCreateAccount";
import type { ProbotEvent } from "../../probot-types";

type ReviewState = "APPROVED" | "CHANGES_REQUESTED" | "DISMISSED";

interface ReviewStates {
  approved: number;
  changesRequested: number;
  dismissed: number;
}

export type Reviewer = AccountInfo;

/** @deprecated use getReviewersWithState instead */
export const getReviewersAndReviewStates = async <
  EventName extends EmitterWebhookEventName,
>(
  context: ProbotEvent<EventName>,
): Promise<{
  reviewers: Reviewer[];
  reviewStates: ReviewStates;
}> => {
  const userIds = new Set<number>();
  const reviewers: Reviewer[] = [];
  const reviewStatesByUser = new Map<number, ReviewState>();

  await context.octokit.paginate(
    context.octokit.rest.pulls.listReviews,
    context.pullRequest({ page: undefined }),
    ({ data: reviews }) => {
      reviews.forEach((review) => {
        if (!review.user) return;
        if (!userIds.has(review.user.id)) {
          userIds.add(review.user.id);
          reviewers.push({
            id: review.user.id,
            login: review.user.login,
            type: review.user.type,
          });
        }
        const state = review.state.toUpperCase();
        if (state !== "COMMENTED") {
          reviewStatesByUser.set(review.user.id, state as ReviewState);
        }
      });

      return [];
    },
  );

  const reviewStates: ReviewStates = {
    approved: 0,
    changesRequested: 0,
    dismissed: 0,
  };

  reviewers.forEach((reviewer) => {
    const state = reviewStatesByUser.get(reviewer.id);
    switch (state) {
      case "APPROVED":
        reviewStates.approved++;
        break;
      case "CHANGES_REQUESTED":
        reviewStates.changesRequested++;
        break;
      case "DISMISSED":
        reviewStates.dismissed++;
        break;
      case undefined:
      default:
        break;
    }
  });

  return { reviewers, reviewStates };
};
