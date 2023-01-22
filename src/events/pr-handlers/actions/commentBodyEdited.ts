import type { EventsWithRepository, RepoContext } from 'context/repoContext';
import type { ProbotEvent } from 'events/probot-types';
import type { AppContext } from '../../../context/AppContext';
import { getChecksAndStatusesForPullRequest } from '../../../utils/github/pullRequest/checksAndStatuses';
import type { PullRequestFromRestEndpoint } from '../utils/PullRequestData';
import type { ReviewflowPrContext } from '../utils/createPullRequestContext';
import { getFailedOrWaitingChecksAndStatuses } from '../utils/getFailedOrWaitingChecksAndStatuses';
import { autoMergeIfPossible } from './autoMergeIfPossible';
import { editOpenedPR } from './editOpenedPR';
import {
  disableGithubAutoMerge,
  mergeOrEnableGithubAutoMerge,
} from './enableGithubAutoMerge';
import { updateBranch } from './updateBranch';
import { updatePrCommentBodyIfNeeded } from './updatePrCommentBody';
import { updateStatusCheckFromStepsState } from './updateStatusCheckFromStepsState';
import { calcDefaultOptions } from './utils/body/prOptions';
import { updateCommentOptions } from './utils/body/updateBody';
import { getStateChecksLabelsToSync } from './utils/labels/getStateChecksLabelsToSync';
import { calcStepsState } from './utils/steps/calcStepsState';
import type { LabelToSync } from './utils/syncLabel';
import { syncLabels, removeLabel } from './utils/syncLabel';

export const commentBodyEdited = async <Name extends EventsWithRepository>(
  pullRequest: PullRequestFromRestEndpoint,
  context: ProbotEvent<Name>,
  appContext: AppContext,
  repoContext: RepoContext,
  reviewflowPrContext: ReviewflowPrContext,
): Promise<void> => {
  const automergeLabel = repoContext.labels['merge/automerge'];
  const skipCiLabel = repoContext.labels['merge/skip-ci'];
  const updateBranchLabel = repoContext.labels['merge/update-branch'];

  const { commentBody, options, actions } = updateCommentOptions(
    repoContext.settings,
    context.payload.repository.html_url,
    repoContext.config.labels.list,
    reviewflowPrContext.commentBody,
    calcDefaultOptions(repoContext, pullRequest),
  );

  await updatePrCommentBodyIfNeeded(context, reviewflowPrContext, commentBody);

  if (options) {
    const shouldUpdateChecks = actions.includes('updateChecks');

    const checksAndStatuses = shouldUpdateChecks
      ? await getChecksAndStatusesForPullRequest(context, pullRequest)
      : undefined;

    const calcStateLabels = async (): Promise<LabelToSync[]> => {
      const { state } = getFailedOrWaitingChecksAndStatuses(
        checksAndStatuses!,
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
        shouldHaveLabel: actions.includes('updateBranch') ? true : null,
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
          if (
            repoContext.settings.allowAutoMerge &&
            repoContext.config.experimentalFeatures?.githubAutoMerge
          ) {
            return (
              (await mergeOrEnableGithubAutoMerge(
                pullRequest,
                context,
                repoContext,
                reviewflowPrContext,
              )) !== null
            );
          } else {
            await autoMergeIfPossible(
              pullRequest,
              context,
              repoContext,
              reviewflowPrContext,
              prLabels,
            );
            return true;
          }
        },
        onRemove: async () => {
          if (
            repoContext.settings.allowAutoMerge &&
            repoContext.config.experimentalFeatures?.githubAutoMerge
          ) {
            return disableGithubAutoMerge(
              pullRequest,
              context,
              repoContext,
              reviewflowPrContext,
            );
          } else {
            await repoContext.removePrFromAutomergeQueue(
              context,
              pullRequest,
              'label removed',
            );
            return true;
          }
        },
      },

      ...(shouldUpdateChecks ? await calcStateLabels() : []),
    ]);

    // update checks, after labels update.
    if (shouldUpdateChecks) {
      const stepsState = calcStepsState({
        repoContext,
        pullRequest,
        labels: updatedLabels,
      });

      if (checksAndStatuses) {
        reviewflowPrContext.reviewflowPr.checksConclusion =
          checksAndStatuses.checksConclusionRecord;
        reviewflowPrContext.reviewflowPr.statusesConclusion =
          checksAndStatuses.statusesConclusionRecord;
      }

      await Promise.all([
        editOpenedPR({
          pullRequest,
          context,
          appContext,
          repoContext,
          reviewflowPrContext,
          stepsState,
          shouldUpdateCommentBodyProgress: true,
          shouldUpdateCommentBodyInfos: true,
          checksAndStatuses,
        }),
        updateStatusCheckFromStepsState(
          stepsState,
          pullRequest,
          context,
          repoContext,
          appContext,
          reviewflowPrContext,
        ),
      ]);
    }
  }
};
