import type { ReviewLabels } from "reviewflow-core";
import type { LabelResponse } from "../../../context/initRepoLabels.ts";
import type {
  EventsWithRepository,
  RepoContext,
} from "../../../context/repoContext.ts";
import type { ProbotEvent } from "../../probot-types.ts";
import type {
  PullRequestLabels,
  PullRequestWithDecentData,
} from "../utils/PullRequestData.ts";
import type { ReviewflowPrContext } from "../utils/createPullRequestContext.ts";
import type { StepsState } from "./utils/steps/calcStepsState.ts";
import type { LabelToSync } from "./utils/syncLabel.ts";
import { syncLabels } from "./utils/syncLabel.ts";

export const updateReviewStatus = async <
  EventName extends EventsWithRepository,
  TeamNames extends string,
>(
  pullRequest: PullRequestWithDecentData,
  context: ProbotEvent<EventName>,
  repoContext: RepoContext<TeamNames>,
  stepsState: StepsState,
  reviewflowPrContext: ReviewflowPrContext | null,
): Promise<PullRequestLabels> => {
  const getLabelFromKey = (key: ReviewLabels): LabelResponse | undefined => {
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

  return syncLabels(
    pullRequest,
    context,
    [
      {
        label: getLabelFromKey("needsReview"),
        shouldHaveLabel: stepsState.codeReview.isMissingReview,
      },
      {
        label: getLabelFromKey("requested"),
        shouldHaveLabel:
          stepsState.codeReview.hasRequestedReviewers ||
          stepsState.codeReview.hasRequestedTeams,
      },
      {
        label: getLabelFromKey("changesRequested"),
        shouldHaveLabel: stepsState.codeReview.hasChangesRequested,
      },
      {
        label: getLabelFromKey("approved"),
        shouldHaveLabel: stepsState.codeReview.isApproved,
      },
      ...teamLabels,
    ],
    reviewflowPrContext
      ? {
          appContext: repoContext.appContext,
          reviewflowPr: reviewflowPrContext.reviewflowPr,
        }
      : undefined,
  );
};
