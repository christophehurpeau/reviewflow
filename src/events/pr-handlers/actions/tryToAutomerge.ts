import type { EventsWithRepository, RepoContext } from 'context/repoContext';
import type { ProbotEvent } from 'events/probot-types';
import type { BasicUser, PullRequestLabels } from '../utils/PullRequestData';
import type { ReviewflowPrContext } from '../utils/createPullRequestContext';
import type { PullRequestFromRestEndpoint } from '../utils/fetchPr';
import { autoMergeIfPossibleLegacy } from './autoMergeIfPossible';
import { mergeOrEnableGithubAutoMerge } from './enableGithubAutoMerge';
import hasLabelInPR from './utils/labels/hasLabelInPR';
import type { StepsState } from './utils/steps/calcStepsState';
import {
  calcStepsState,
  isAllStepsExceptMergePassed,
} from './utils/steps/calcStepsState';

interface TryToAutomergeOptions<
  EventName extends EventsWithRepository,
  TeamNames extends string,
> {
  pullRequest: PullRequestFromRestEndpoint;
  context: ProbotEvent<EventName>;
  repoContext: RepoContext<TeamNames>;
  reviewflowPrContext: ReviewflowPrContext;
  stepsState?: StepsState;
  pullRequestLabels?: PullRequestLabels;
  user?: BasicUser;
}

export async function tryToAutomerge<
  EventName extends EventsWithRepository,
  TeamNames extends string,
>({
  pullRequest,
  pullRequestLabels = pullRequest.labels,
  context,
  repoContext,
  reviewflowPrContext,
  stepsState = calcStepsState({
    pullRequest,
    repoContext,
    reviewflowPrContext,
  }),
  user = context.payload.sender,
}: TryToAutomergeOptions<EventName, TeamNames>): Promise<boolean> {
  const autoMergeLabel = repoContext.labels['merge/automerge'];

  if (!hasLabelInPR(pullRequestLabels, autoMergeLabel)) {
    return false;
  }

  if (repoContext.settings.allowAutoMerge) {
    return (
      (await mergeOrEnableGithubAutoMerge(
        pullRequest,
        context,
        repoContext,
        reviewflowPrContext,
        user,
        !isAllStepsExceptMergePassed(stepsState),
      )) === true
    );
  } else {
    if (!isAllStepsExceptMergePassed(stepsState)) {
      return false;
    }

    return autoMergeIfPossibleLegacy(
      pullRequest,
      context,
      repoContext,
      reviewflowPrContext,
    );
  }
}
