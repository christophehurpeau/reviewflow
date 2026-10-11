import type { AppContext } from "../../../context/AppContext.ts";
import type { RepoContext } from "../../../context/repoContext.ts";
import type { ReviewsState } from "../../../utils/github/pullRequest/reviews.ts";
import type { ProbotEvent } from "../../probot-types.ts";
import type { PullRequestFromRestEndpoint } from "../utils/PullRequestData.ts";
import type { ReviewflowPrContext } from "../utils/createPullRequestContext.ts";
import type { EventsWithPullRequest } from "../utils/createPullRequestHandler.ts";
import { fetchPr } from "../utils/fetchPr.ts";
import { groupReviewsState } from "../utils/groupReviewsWithState.ts";
import { tryToAutomerge } from "./tryToAutomerge.ts";
import { updateCommentBodyProgressFromStepsState } from "./updateCommentBodyProgressFromStepsState.ts";
import { updateReviewStatus } from "./updateReviewStatus.ts";
import { updateStatusCheckFromStepsState } from "./updateStatusCheckFromStepsState.ts";
import { calcStepsState } from "./utils/steps/calcStepsState.ts";
import { toReviewState } from "./utils/steps/reviewState.ts";

export interface UpdateAfterReviewChangeResult {
  wasMerged: boolean;
}

export async function updateAfterReviewChange<
  EventName extends EventsWithPullRequest,
  TeamNames extends string,
>(
  pullRequest: PullRequestFromRestEndpoint,
  context: ProbotEvent<EventName>,
  appContext: AppContext,
  repoContext: RepoContext<TeamNames>,
  reviewflowPrContext: ReviewflowPrContext,
  reviewsState: ReviewsState,
  requestedNow?: { reviewerId: number; at: Date },
): Promise<UpdateAfterReviewChangeResult> {
  // calcStepsState reads the reviews from the context
  reviewflowPrContext.reviewflowPr.reviews = groupReviewsState(
    reviewsState,
    reviewflowPrContext.reviewflowPr.reviews,
    requestedNow,
  );

  const stepsState = calcStepsState({
    pullRequest,
    repoContext,
    reviewflowPrContext,
  });

  const updateReviewflowPrPromise = appContext.mongoStores.prs.partialUpdateOne(
    reviewflowPrContext.reviewflowPr,
    {
      $set: {
        reviews: reviewflowPrContext.reviewflowPr.reviews,
        reviewState: toReviewState(stepsState.codeReview),
      },
    },
  );

  await Promise.all([
    updateReviewflowPrPromise,
    updateReviewStatus(
      pullRequest,
      context,
      repoContext,
      stepsState,
      reviewflowPrContext,
    ),
    updateStatusCheckFromStepsState(
      stepsState,
      pullRequest,
      context,
      repoContext,
      appContext,
      reviewflowPrContext,
    ),
    updateCommentBodyProgressFromStepsState(
      stepsState,
      context,
      reviewflowPrContext,
    ),
  ]);

  const { wasMerged } = await tryToAutomerge({
    pullRequest: await fetchPr(context, pullRequest.number),
    context,
    repoContext,
    reviewflowPrContext,
    stepsState,
  });
  return {
    wasMerged,
  };
}
