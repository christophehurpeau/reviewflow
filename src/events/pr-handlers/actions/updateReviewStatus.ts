import type { ReviewLabels } from '../../../accountConfigs/types';
import type {
  EventsWithRepository,
  RepoContext,
} from '../../../context/repoContext';
import type { ProbotEvent } from '../../probot-types';
import type {
  PullRequestLabels,
  PullRequestWithDecentData,
} from '../utils/PullRequestData';
import type { StepsState } from './utils/steps/calcStepsState';
import type { LabelToSync } from './utils/syncLabel';
import { syncLabels } from './utils/syncLabel';

export const updateReviewStatus = async <
  EventName extends EventsWithRepository,
  TeamNames extends string,
>(
  pullRequest: PullRequestWithDecentData,
  context: ProbotEvent<EventName>,
  repoContext: RepoContext<TeamNames>,
  stepsState: StepsState,
): Promise<PullRequestLabels> => {
  const getLabelFromKey = (
    key: ReviewLabels,
  ): undefined | PullRequestLabels[number] => {
    const reviewConfig = repoContext.config.labels.review;
    if (!reviewConfig) return undefined;

    return reviewConfig[key] && repoContext.labels[reviewConfig[key]]
      ? repoContext.labels[reviewConfig[key]]
      : undefined;
  };

  // TODO move that elsewhere
  const teamLabels: LabelToSync[] = [];
  if (pullRequest.user) {
    repoContext.getTeamsForLogin(pullRequest.user.login).forEach((teamName) => {
      const team = repoContext.config.teams[teamName];
      if (team.labels) {
        team.labels.forEach((labelKey) => {
          const label = repoContext.labels[labelKey];
          if (label) {
            teamLabels.push({ shouldHaveLabel: true, label });
          }
        });
      }
    });
  }

  return syncLabels(pullRequest, context, [
    {
      label: getLabelFromKey('needsReview'),
      shouldHaveLabel: stepsState.codeReview.isMissingReview,
    },
    {
      label: getLabelFromKey('requested'),
      shouldHaveLabel:
        stepsState.codeReview.hasRequestedReviewers ||
        stepsState.codeReview.hasRequestedTeams,
    },
    {
      label: getLabelFromKey('changesRequested'),
      shouldHaveLabel: stepsState.codeReview.hasChangesRequested,
    },
    {
      label: getLabelFromKey('approved'),
      shouldHaveLabel: stepsState.codeReview.isApproved,
    },
    ...teamLabels,
  ]);
};
