import type { AppContext } from "../../../context/AppContext";
import type { RepoContext } from "../../../context/repoContext";
import type { ReviewsState } from "../../../utils/github/pullRequest/reviews";
import type { ProbotEvent } from "../../probot-types";
import type { PullRequestFromRestEndpoint } from "../utils/PullRequestData";
import type { ReviewflowPrContext } from "../utils/createPullRequestContext";
import type { EventsWithPullRequest } from "../utils/createPullRequestHandler";
import { fetchPr } from "../utils/fetchPr";
import { groupReviewsState } from "../utils/groupReviewsWithState";
import { tryToAutomerge } from "./tryToAutomerge";
import { updateCommentBodyProgressFromStepsState } from "./updateCommentBodyProgressFromStepsState";
import { updateReviewStatus } from "./updateReviewStatus";
import { updateStatusCheckFromStepsState } from "./updateStatusCheckFromStepsState";
import { calcStepsState } from "./utils/steps/calcStepsState";

export async function updateOnlyReviewflowPrReviews(
  appContext: AppContext,
  reviewflowPrContext: ReviewflowPrContext,
  reviewsState: ReviewsState,
): Promise<void> {
  reviewflowPrContext.reviewflowPr.reviews = groupReviewsState(reviewsState);

  await appContext.mongoStores.prs.partialUpdateOne(
    reviewflowPrContext.reviewflowPr,
    { $set: { reviews: reviewflowPrContext.reviewflowPr.reviews } },
  );
}

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
): Promise<UpdateAfterReviewChangeResult> {
  // updates reviewflowPrContext.reviewflowPr.reviews before calling calcStepsState
  const updateReviewflowPrPromise = updateOnlyReviewflowPrReviews(
    appContext,
    reviewflowPrContext,
    reviewsState,
  );

  const stepsState = calcStepsState({
    pullRequest,
    repoContext,
    reviewflowPrContext,
  });

  await Promise.all([
    updateReviewflowPrPromise,
    updateReviewStatus(pullRequest, context, repoContext, stepsState),
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
