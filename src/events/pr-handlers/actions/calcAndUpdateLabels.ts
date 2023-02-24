import type { ProbotEvent } from 'events/probot-types';
import type { AppContext } from '../../../context/AppContext';
import type { LabelResponse } from '../../../context/initRepoLabels';
import type {
  EventsWithRepository,
  RepoContext,
} from '../../../context/repoContext';
import type { PullRequestWithDecentData } from '../utils/PullRequestData';
import type { ReviewflowPrContext } from '../utils/createPullRequestContext';
import { getFailedOrWaitingChecksAndStatuses } from '../utils/getFailedOrWaitingChecksAndStatuses';
import { updateCommentBodyProgressFromStepsState } from './updateCommentBodyProgressFromStepsState';
import { updateStatusCheckFromStepsState } from './updateStatusCheckFromStepsState';
import { getStateChecksLabelsToSync } from './utils/labels/getStateChecksLabelsToSync';
import { calcStepsState } from './utils/steps/calcStepsState';
import { syncLabels } from './utils/syncLabel';

export async function calcAndUpdateLabels<
  EventName extends EventsWithRepository,
  GroupNames extends string,
>(
  context: ProbotEvent<EventName>,
  appContext: AppContext,
  repoContext: RepoContext<GroupNames>,
  pullRequest: PullRequestWithDecentData,
  reviewflowPrContext: ReviewflowPrContext,
  updateStatusCheckAndBodyProgress = true,
): Promise<LabelResponse[] | PullRequestWithDecentData['labels']> {
  if (
    !reviewflowPrContext ||
    !reviewflowPrContext.reviewflowPr.checksConclusion ||
    !reviewflowPrContext.reviewflowPr.statusesConclusion
  ) {
    return pullRequest.labels;
  }

  const { state } = getFailedOrWaitingChecksAndStatuses(
    {
      checksConclusionRecord: reviewflowPrContext.reviewflowPr.checksConclusion,
      statusesConclusionRecord:
        reviewflowPrContext.reviewflowPr.statusesConclusion,
    },
    repoContext,
  );

  const updatedLabels = await syncLabels(
    pullRequest,
    context,
    getStateChecksLabelsToSync(repoContext, state),
  );

  if (updateStatusCheckAndBodyProgress) {
    const stepsState = calcStepsState({
      repoContext,
      pullRequest,
      reviewflowPrContext,
      labels: updatedLabels,
    });

    await Promise.all([
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
  }

  return updatedLabels;
}
