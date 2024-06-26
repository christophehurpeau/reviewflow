import type { AccountInfo } from "../../../context/getOrCreateAccount";
import type { EventsWithRepository } from "../../../context/repoContext";
import type { PullRequestWithDecentData } from "../../../events/pr-handlers/utils/PullRequestData";
import type { ProbotEvent } from "../../../events/probot-types";

type ReviewState =
  | "APPROVED"
  | "CHANGES_REQUESTED"
  | "DISMISSED"
  | "REVIEW_REQUESTED";

export type Reviewer = AccountInfo;

export interface ReviewerWithState extends Reviewer {
  state?: ReviewState; // state can be undefined if the user only commented
}

export interface TeamInfo {
  id: number;
  name: string;
}

export interface ReviewsState {
  reviewersWithState: ReviewerWithState[];
  requestedReviewers: AccountInfo[];
  requestedTeam: TeamInfo[];
}

export const getReviewsState = async <EventName extends EventsWithRepository>(
  context: ProbotEvent<EventName>,
  pullRequest: PullRequestWithDecentData,
): Promise<ReviewsState> => {
  const userIds = new Set<number>();
  const reviewers: Reviewer[] = [];

  const reviewStatesByUser = new Map<number, ReviewState>();

  // in chronological order
  await context.octokit.paginate(
    context.octokit.pulls.listReviews,
    context.repo({ page: undefined, pull_number: pullRequest.number }),
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

  // override state if review is requested since
  const requestedReviewers = pullRequest.requested_reviewers || [];
  requestedReviewers.forEach((rr) => {
    if (!userIds.has(rr.id)) {
      userIds.add(rr.id);
      reviewers.push({
        id: rr.id,
        login: (rr as any).login,
        type: (rr as any).type,
      });
    }
    reviewStatesByUser.set(rr.id, "REVIEW_REQUESTED");
  });

  const reviewersWithState = reviewers.map((reviewer) => {
    const state = reviewStatesByUser.get(reviewer.id);
    return { ...reviewer, state };
  });

  return {
    reviewersWithState,
    requestedReviewers: requestedReviewers.map((rr) => ({
      id: rr.id,
      login: (rr as any).login,
      type: (rr as any).type,
    })),
    requestedTeam: (pullRequest.requested_teams || []).map((team) => ({
      id: team.id,
      name: team.name,
    })),
  };
};
