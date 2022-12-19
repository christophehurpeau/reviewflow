import type { EventsWithRepository } from 'context/repoContext';
import type { ProbotEvent } from '../../probot-types';
import type { ReviewflowPrContext } from '../utils/createPullRequestContext';
import { updatePrCommentBodyIfNeeded } from './updatePrCommentBody';
import {
  updateCommentBodyProgress,
  defaultCommentBody,
} from './utils/body/updateBody';
import type { StepsState } from './utils/steps/calcStepsState';

export async function updateCommentBodyProgressFromStepsState<
  Name extends EventsWithRepository,
>(
  stepsState: StepsState,
  context: ProbotEvent<Name>,
  reviewflowPrContext: ReviewflowPrContext,
): Promise<void> {
  if (reviewflowPrContext.commentBody === defaultCommentBody) return;

  const newCommentBody = updateCommentBodyProgress(
    reviewflowPrContext.commentBody,
    stepsState,
  );

  await updatePrCommentBodyIfNeeded(
    context,
    reviewflowPrContext,
    newCommentBody,
  );
}
