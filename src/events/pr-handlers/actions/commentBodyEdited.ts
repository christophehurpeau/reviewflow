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
import hasLabelInPR from './utils/hasLabelInPR';
import syncLabel from './utils/syncLabel';

export const commentBodyEdited = async <Name extends EventsWithRepository>(
  pullRequest: PullRequestFromRestEndpoint,
  context: ProbotEvent<Name>,
  appContext: AppContext,
  repoContext: RepoContext,
  reviewflowPrContext: ReviewflowPrContext,
): Promise<void> => {
  const automergeLabel = repoContext.labels['merge/automerge'];
  const skipCiLabel = repoContext.labels['merge/skip-ci'];

  const prHasSkipCiLabel = hasLabelInPR(pullRequest.labels, skipCiLabel);
  const prHasAutoMergeLabel = hasLabelInPR(pullRequest.labels, automergeLabel);

  const { commentBody, options, actions } = updateCommentOptions(
    context.payload.repository.html_url,
    repoContext.config.labels.list,
    reviewflowPrContext.commentBody,
    calcDefaultOptions(repoContext, pullRequest),
  );

  await updatePrCommentBodyIfNeeded(context, reviewflowPrContext, commentBody);

  if (options && automergeLabel) {
    await Promise.all([
      skipCiLabel &&
        syncLabel(
          pullRequest,
          context,
          options.autoMergeWithSkipCi,
          skipCiLabel,
          prHasSkipCiLabel,
        ),

      actions.includes('updateBranch') &&
        updateBranch(pullRequest, context, context.payload.sender.login),
      actions.includes('updateChecks') &&
        Promise.all([
          editOpenedPR(
            pullRequest,
            context,
            appContext,
            repoContext,
            reviewflowPrContext,
            true,
          ),
          updateStatusCheckFromLabels(
            pullRequest,
            context,
            appContext,
            repoContext,
            reviewflowPrContext,
            pullRequest.labels,
          ),
        ]),
      automergeLabel &&
        syncLabel(
          pullRequest,
          context,
          options.autoMerge,
          automergeLabel,
          prHasAutoMergeLabel,
          {
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
        ),
    ]);
  }
};
