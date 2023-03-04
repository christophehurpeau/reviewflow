import type { AppContext } from 'context/AppContext';
import type { RepoContext } from 'context/repoContext';
import type { ProbotEvent } from 'events/probot-types';
import type { ReviewerWithState } from '../../../utils/github/pullRequest/reviews';
import type { PullRequestFromRestEndpoint } from '../utils/PullRequestData';
import type { ReviewflowPrContext } from '../utils/createPullRequestContext';
import type { EventsWithPullRequest } from '../utils/createPullRequestHandler';
import { fetchPr } from '../utils/fetchPr';
import { groupReviewsWithState } from '../utils/groupReviewsWithState';
import { tryToAutomerge } from './tryToAutomerge';
import { updateCommentBodyProgressFromStepsState } from './updateCommentBodyProgressFromStepsState';
import { updateReviewStatus } from './updateReviewStatus';
import { updateStatusCheckFromStepsState } from './updateStatusCheckFromStepsState';
import { calcStepsState } from './utils/steps/calcStepsState';

export async function updateOnlyReviewflowPrReviews(
  appContext: AppContext,
  reviewflowPrContext: ReviewflowPrContext,
  reviewersWithState: ReviewerWithState[],
): Promise<void> {
  reviewflowPrContext.reviewflowPr.reviews =
    groupReviewsWithState(reviewersWithState);

  await appContext.mongoStores.prs.partialUpdateOne(
    reviewflowPrContext.reviewflowPr,
    { $set: { reviews: reviewflowPrContext.reviewflowPr.reviews } },
  );
}

export interface UpdateAfterReviewChangeResult {
  isMerged: boolean;
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
  reviewersWithState: ReviewerWithState[],
): Promise<UpdateAfterReviewChangeResult> {
  // updates reviewflowPrContext.reviewflowPr.reviews before calling calcStepsState
  const updateReviewflowPrPromise = updateOnlyReviewflowPrReviews(
    appContext,
    reviewflowPrContext,
    reviewersWithState,
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

  return {
    isMerged: await tryToAutomerge({
      pullRequest: await fetchPr(context, pullRequest.number),
      context,
      repoContext,
      reviewflowPrContext,
      stepsState,
    }),
  };
}
