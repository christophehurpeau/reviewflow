import type { AppContext } from "../../../context/AppContext";
import type {
  EventsWithRepository,
  RepoContext,
} from "../../../context/repoContext";
import { getChecksAndStatusesForPullRequest } from "../../../utils/github/pullRequest/checksAndStatuses";
import { getReviewsState } from "../../../utils/github/pullRequest/reviews";
import type { ProbotEvent } from "../../probot-types";
import type { PullRequestFromRestEndpoint } from "../utils/PullRequestData";
import type { ReviewflowPrContext } from "../utils/createPullRequestContext";
import { getFailedOrWaitingChecksAndStatuses } from "../utils/getFailedOrWaitingChecksAndStatuses";
import { groupReviewsState } from "../utils/groupReviewsWithState";
import { editOpenedPR } from "./editOpenedPR";
import { disableGithubAutoMerge } from "./enableGithubAutoMerge";
import { tryToAutomerge } from "./tryToAutomerge";
import { updateBranch } from "./updateBranch";
import { updatePrCommentBodyIfNeeded } from "./updatePrCommentBody";
import { updateReviewStatus } from "./updateReviewStatus";
import { updateStatusCheckFromStepsState } from "./updateStatusCheckFromStepsState";
import { calcDefaultOptions } from "./utils/body/prOptions";
import { updateCommentOptions } from "./utils/body/updateBody";
import { getStateChecksLabelsToSync } from "./utils/labels/getStateChecksLabelsToSync";
import { calcStepsState } from "./utils/steps/calcStepsState";
import type { LabelToSync } from "./utils/syncLabel";
import { removeLabel, syncLabels } from "./utils/syncLabel";

export const commentBodyEdited = async <Name extends EventsWithRepository>(
  pullRequest: PullRequestFromRestEndpoint,
  context: ProbotEvent<Name>,
  appContext: AppContext,
  repoContext: RepoContext,
  reviewflowPrContext: ReviewflowPrContext,
): Promise<void> => {
  const automergeLabel = repoContext.labels["merge/automerge"];
  const skipCiLabel = repoContext.labels["merge/skip-ci"];
  const updateBranchLabel = repoContext.labels["merge/update-branch"];

  const { commentBody, options, actions } = updateCommentOptions(
    repoContext.settings,
    context.payload.repository.html_url,
    repoContext.config.labels.list,
    reviewflowPrContext.commentBody,
    calcDefaultOptions(repoContext, pullRequest.labels),
  );

  await updatePrCommentBodyIfNeeded(context, reviewflowPrContext, commentBody);

  if (options) {
    const shouldUpdateChecks = actions.includes("updateChecks");

    const [checksAndStatuses, reviewsState] = await Promise.all([
      shouldUpdateChecks &&
        getChecksAndStatusesForPullRequest(context, pullRequest),
      shouldUpdateChecks && getReviewsState(context, pullRequest),
    ]);

    const calcStateLabels = (): LabelToSync[] => {
      if (!checksAndStatuses) return [];
      const { state } = getFailedOrWaitingChecksAndStatuses(
        checksAndStatuses,
        repoContext,
      );
      return getStateChecksLabelsToSync(repoContext, state);
    };

    const updatedLabels = await syncLabels(pullRequest, context, [
      {
        shouldHaveLabel: options.autoMergeWithSkipCi,
        label: skipCiLabel,
      },
      {
        shouldHaveLabel: actions.includes("updateBranch") ? true : null,
        label: updateBranchLabel,
        onAdd: async () => {
          await updateBranch(
            pullRequest,
            context,
            context.payload.sender.login,
          );
          await removeLabel(context, pullRequest, updateBranchLabel);
        },
      },
      {
        shouldHaveLabel: options.autoMerge,
        label: automergeLabel,
        onAdd: async (prLabels) => {
          const stepsState = calcStepsState({
            repoContext,
            pullRequest,
            reviewflowPrContext,
          });
          await updateStatusCheckFromStepsState(
            stepsState,
            pullRequest,
            context,
            repoContext,
            appContext,
            reviewflowPrContext,
            prLabels,
          );
          await tryToAutomerge({
            pullRequest,
            pullRequestLabels: prLabels,
            context,
            repoContext,
            reviewflowPrContext,
            stepsState,
          });
        },
        onRemove: async (prLabels) => {
          const stepsState = calcStepsState({
            repoContext,
            pullRequest,
            reviewflowPrContext,
          });
          await updateStatusCheckFromStepsState(
            stepsState,
            pullRequest,
            context,
            repoContext,
            appContext,
            reviewflowPrContext,
            prLabels,
          );
          if (repoContext.settings.allowAutoMerge) {
            return disableGithubAutoMerge(
              pullRequest,
              context,
              repoContext,
              reviewflowPrContext,
            );
          } else {
            return true;
          }
        },
      },

      ...(shouldUpdateChecks ? calcStateLabels() : []),
    ]);

    // update checks and reviews after labels update.
    if (shouldUpdateChecks && checksAndStatuses && reviewsState) {
      reviewflowPrContext.reviewflowPr.reviews =
        groupReviewsState(reviewsState);
      reviewflowPrContext.reviewflowPr.checksConclusion =
        checksAndStatuses.checksConclusionRecord;
      reviewflowPrContext.reviewflowPr.statusesConclusion =
        checksAndStatuses.statusesConclusionRecord;

      const stepsState = calcStepsState({
        repoContext,
        pullRequest,
        reviewflowPrContext,
      });

      await Promise.all([
        updateReviewStatus(pullRequest, context, repoContext, stepsState),
        editOpenedPR({
          pullRequest,
          pullRequestLabels: updatedLabels,
          context,
          appContext,
          repoContext,
          reviewflowPrContext,
          stepsState,
          shouldUpdateCommentBodyProgress: true,
          shouldUpdateCommentBodyInfos: true,
          checksAndStatuses,
          reviews: reviewflowPrContext.reviewflowPr.reviews,
        }),
        updateStatusCheckFromStepsState(
          stepsState,
          pullRequest,
          context,
          repoContext,
          appContext,
          reviewflowPrContext,
          updatedLabels,
        ),
      ]);
    }
  }
};
