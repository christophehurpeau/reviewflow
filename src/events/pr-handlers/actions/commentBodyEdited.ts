import type { EventsWithRepository, RepoContext } from 'context/repoContext';
import type { ProbotEvent } from 'events/probot-types';
import type { AppContext } from '../../../context/AppContext';
import type { PullRequestFromRestEndpoint } from '../utils/PullRequestData';
import type { ReviewflowPrContext } from '../utils/createPullRequestContext';
import { autoMergeIfPossible } from './autoMergeIfPossible';
import { editOpenedPR } from './editOpenedPR';
import { updateBranch } from './updateBranch';
import { updatePrCommentBodyIfNeeded } from './updatePrCommentBody';
import { updateStatusCheckFromLabels } from './updateStatusCheckFromLabels';
import { calcDefaultOptions } from './utils/body/prOptions';
import { updateCommentOptions } from './utils/body/updateBody';
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
    context.payload.repository.html_url,
    repoContext.config.labels.list,
    reviewflowPrContext.commentBody,
    calcDefaultOptions(repoContext, pullRequest),
  );

  await updatePrCommentBodyIfNeeded(context, reviewflowPrContext, commentBody);

  if (options) {
    await Promise.all([
      actions.includes('updateChecks') &&
        Promise.all([
          editOpenedPR({
            pullRequest,
            context,
            appContext,
            repoContext,
            reviewflowPrContext,
            shouldUpdateCommentBodyInfos: true,
          }),
          updateStatusCheckFromLabels(
            pullRequest,
            context,
            appContext,
            repoContext,
            reviewflowPrContext,
            pullRequest.labels,
          ),
        ]),
      syncLabels(pullRequest, context, [
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
            await removeLabel(context, updateBranchLabel);
          },
        },
        {
          shouldHaveLabel: options.autoMerge,
          label: automergeLabel,
          onAdd: async (prLabels) => {
            await autoMergeIfPossible(
              pullRequest,
              context,
              repoContext,
              reviewflowPrContext,
              prLabels,
            );
          },
          onRemove: async () => {
            await repoContext.removePrFromAutomergeQueue(
              context,
              pullRequest,
              'label removed',
            );
          },
        },
      ]),
    ]);
  }
};
