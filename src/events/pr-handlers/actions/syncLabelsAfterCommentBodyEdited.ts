import type { Context } from 'probot';
import type { RepoContext } from 'context/repoContext';
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
  const featureBranchLabel = repoContext.labels['feature-branch'];
  const automergeLabel = repoContext.labels['merge/automerge'];
  const skipCiLabel = repoContext.labels['merge/skip-ci'];

  const prHasFeatureBranchLabel = hasLabelInPR(
    pullRequest.labels,
    featureBranchLabel,
  );
  const prHasSkipCiLabel = hasLabelInPR(pullRequest.labels, skipCiLabel);
  const prHasAutoMergeLabel = hasLabelInPR(pullRequest.labels, automergeLabel);

  return {
    ...repoContext.config.prDefaultOptions,
    featureBranch: prHasFeatureBranchLabel,
    autoMergeWithSkipCi: prHasSkipCiLabel,
    autoMerge: prHasAutoMergeLabel,
  };
};

export const syncLabelsAfterCommentBodyEdited = async (
  pullRequest: PullRequestFromRestEndpoint,
  context: Context<any>,
  repoContext: RepoContext,
  reviewflowPrContext: ReviewflowPrContext,
): Promise<void> => {
  const featureBranchLabel = repoContext.labels['feature-branch'];
  const automergeLabel = repoContext.labels['merge/automerge'];
  const skipCiLabel = repoContext.labels['merge/skip-ci'];

  const prHasFeatureBranchLabel = hasLabelInPR(
    pullRequest.labels,
    featureBranchLabel,
  );
  const prHasSkipCiLabel = hasLabelInPR(pullRequest.labels, skipCiLabel);
  const prHasAutoMergeLabel = hasLabelInPR(pullRequest.labels, automergeLabel);

  const { commentBody, options } = updateCommentOptions(
    reviewflowPrContext.commentBody,
    calcDefaultOptions(repoContext, pullRequest),
  );

  await updatePrCommentBodyIfNeeded(context, reviewflowPrContext, commentBody);

  if (options && (featureBranchLabel || automergeLabel)) {
    await Promise.all([
      featureBranchLabel &&
        syncLabel(
          pullRequest,
          context,
          options.featureBranch,
          featureBranchLabel,
          prHasFeatureBranchLabel,
        ),
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
