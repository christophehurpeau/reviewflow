import type { EventsWithRepository, RepoContext } from 'context/repoContext';
import type { ProbotEvent } from 'events/probot-types';
import type {
  PullRequestFromRestEndpoint,
  PullRequestWithDecentData,
} from '../utils/PullRequestData';
import type { ReviewflowPrContext } from '../utils/createPullRequestContext';
import { autoMergeIfPossible } from './autoMergeIfPossible';
import { updatePrCommentBodyIfNeeded } from './updatePrCommentBody';
import type { Options } from './utils/body/prOptions';
import { updateCommentOptions } from './utils/body/updateBody';
import hasLabelInPR from './utils/hasLabelInPR';
import syncLabel from './utils/syncLabel';

export const calcDefaultOptions = (
  repoContext: RepoContext,
  pullRequest: PullRequestWithDecentData,
): Options => {
  const automergeLabel = repoContext.labels['merge/automerge'];
  const skipCiLabel = repoContext.labels['merge/skip-ci'];

  const prHasSkipCiLabel = hasLabelInPR(pullRequest.labels, skipCiLabel);
  const prHasAutoMergeLabel = hasLabelInPR(pullRequest.labels, automergeLabel);

  return {
    ...repoContext.config.prDefaultOptions,
    autoMergeWithSkipCi: prHasSkipCiLabel,
    autoMerge: prHasAutoMergeLabel,
  };
};

export const syncLabelsAfterCommentBodyEdited = async <
  Name extends EventsWithRepository,
>(
  pullRequest: PullRequestFromRestEndpoint,
  context: ProbotEvent<Name>,
  repoContext: RepoContext,
  reviewflowPrContext: ReviewflowPrContext,
): Promise<void> => {
  const automergeLabel = repoContext.labels['merge/automerge'];
  const skipCiLabel = repoContext.labels['merge/skip-ci'];

  const prHasSkipCiLabel = hasLabelInPR(pullRequest.labels, skipCiLabel);
  const prHasAutoMergeLabel = hasLabelInPR(pullRequest.labels, automergeLabel);

  const { commentBody, options } = updateCommentOptions(
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
            onRemove: () => {
              repoContext.removePrFromAutomergeQueue(
                context,
                pullRequest.number,
                'label removed',
              );
            },
          },
        ),
    ]);
  }
};
