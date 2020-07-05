import { Octokit, Context } from 'probot';
import Webhooks from '@octokit/webhooks';
import { RepoContext } from 'context/repoContext';
import { AppContext } from 'context/AppContext';
import {
  PrContext,
  PrContextWithUpdatedPr,
} from '../utils/createPullRequestContext';
import hasLabelInPR from './utils/hasLabelInPR';
import syncLabel from './utils/syncLabel';
import { updateCommentOptions } from './utils/body/updateBody';
import { autoMergeIfPossible } from './autoMergeIfPossible';
import { Options } from './utils/body/prOptions';
import { updatePrIfNeeded } from './updatePr';

export const calcDefaultOptions = (
  repoContext: RepoContext,
  pr:
    | Octokit.PullsGetResponse
    | Webhooks.WebhookPayloadPullRequest['pull_request'],
): Options => {
  const featureBranchLabel = repoContext.labels['feature-branch'];
  const automergeLabel = repoContext.labels['merge/automerge'];
  const skipCiLabel = repoContext.labels['merge/skip-ci'];

  const prHasFeatureBranchLabel = hasLabelInPR(pr.labels, featureBranchLabel);
  const prHasSkipCiLabel = hasLabelInPR(pr.labels, skipCiLabel);
  const prHasAutoMergeLabel = hasLabelInPR(pr.labels, automergeLabel);

  return {
    ...repoContext.config.prDefaultOptions,
    featureBranch: prHasFeatureBranchLabel,
    autoMergeWithSkipCi: prHasSkipCiLabel,
    autoMerge: prHasAutoMergeLabel,
  };
};

export const syncLabelsAfterCommentBodyEdited = async (
  appContext: AppContext,
  repoContext: RepoContext,
  pr:
    | Octokit.PullsGetResponse
    | Webhooks.WebhookPayloadPullRequest['pull_request'],
  context: Context<any>,
  prContext:
    | PrContext<Octokit.PullsGetResponse>
    | PrContext<Webhooks.WebhookPayloadPullRequest['pull_request']>
    | PrContextWithUpdatedPr,
): Promise<void> => {
  const featureBranchLabel = repoContext.labels['feature-branch'];
  const automergeLabel = repoContext.labels['merge/automerge'];
  const skipCiLabel = repoContext.labels['merge/skip-ci'];

  const prHasFeatureBranchLabel = hasLabelInPR(pr.labels, featureBranchLabel);
  const prHasSkipCiLabel = hasLabelInPR(pr.labels, skipCiLabel);
  const prHasAutoMergeLabel = hasLabelInPR(pr.labels, automergeLabel);

  const { commentBody, options } = updateCommentOptions(
    prContext.commentBody,
    calcDefaultOptions(repoContext, pr),
  );

  await updatePrIfNeeded(prContext, context, { commentBody });

  if (options && (featureBranchLabel || automergeLabel)) {
    await Promise.all([
      featureBranchLabel &&
        syncLabel(
          pr,
          context,
          options.featureBranch,
          featureBranchLabel,
          prHasFeatureBranchLabel,
        ),
      skipCiLabel &&
        syncLabel(
          pr,
          context,
          options.autoMergeWithSkipCi,
          skipCiLabel,
          prHasSkipCiLabel,
        ),
      automergeLabel &&
        syncLabel(
          pr,
          context,
          options.autoMerge,
          automergeLabel,
          prHasAutoMergeLabel,
          {
            onAdd: async (prLabels) => {
              await autoMergeIfPossible(prContext, context, prLabels);
            },
            onRemove: () => {
              repoContext.removePrFromAutomergeQueue(
                context,
                pr.number,
                'label removed',
              );
            },
          },
        ),
    ]);
  }
};
