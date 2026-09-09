import type { AccountInfo, ReviewerReview, TeamInfo } from "reviewflow-core";
import type { EventsWithRepository } from "../../../context/repoContext";
import type { PullRequestWithDecentData } from "../../../events/pr-handlers/utils/PullRequestData";
import type { ProbotEvent } from "../../../events/probot-types";
import { ExcludesFalsy } from "../../Excludes.ts";

type ReviewState =
  | "APPROVED"
  | "CHANGES_REQUESTED"
  | "DISMISSED"
  | "REVIEW_REQUESTED";

export type Reviewer = AccountInfo;

export interface ReviewerWithState extends Reviewer {
  state?: ReviewState; // state can be undefined if the user only commented
  /**
   * The review they submitted, absent for a reviewer who was only asked and
   * never submitted anything. A review request overrides `state`, so this is
   * the only thing left telling a first review apart from one asked again.
   */
  review?: Omit<ReviewerReview, "id" | "login">;
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
  /** keyed on everyone who reviewed or was asked to, in that order */
  const reviewersById = new Map<number, ReviewerWithState>();

  // in chronological order
  await context.octokit.paginate(
    context.octokit.rest.pulls.listReviews,
    context.repo({ page: undefined, pull_number: pullRequest.number }),
    ({ data: reviews }) => {
      reviews.forEach((review) => {
        if (!review.user) return;
        let reviewer = reviewersById.get(review.user.id);
        if (!reviewer) {
          reviewer = {
            id: review.user.id,
            login: review.user.login,
            type: review.user.type,
          };
          reviewersById.set(review.user.id, reviewer);
        }

        // `review` records that they reviewed at all, its date only their last
        // decision: commenting again afterwards does not undo it. Github
        // backfills `submitted_at` on every submitted review; a pending one it
        // would omit is not one of these.
        reviewer.review ??= { endedAt: undefined };
        const state = review.state.toUpperCase();
        if (state !== "COMMENTED") {
          reviewer.state = state as ReviewState;
          reviewer.review.endedAt = new Date(review.submitted_at ?? Date.now());
        }
      });

      return [];
    },
  );

  // override state if review is requested since
  const requestedReviewers = pullRequest.requested_reviewers || [];
  requestedReviewers.filter(ExcludesFalsy).forEach((rr) => {
    const reviewer = reviewersById.get(rr.id);
    if (reviewer) {
      reviewer.state = "REVIEW_REQUESTED";
    } else {
      // never reviewed anything, so `review` stays absent rather than empty
      reviewersById.set(rr.id, {
        id: rr.id,
        login: (rr as any).login,
        type: (rr as any).type,
        state: "REVIEW_REQUESTED",
      });
    }
  });

  return {
    reviewersWithState: [...reviewersById.values()],
    requestedReviewers: requestedReviewers.filter(ExcludesFalsy).map((rr) => ({
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
