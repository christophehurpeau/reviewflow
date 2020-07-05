import Webhooks from '@octokit/webhooks';
import { Context, Octokit } from 'probot';
import { contextPr } from '../../../context/utils';
import { PrContext } from '../utils/createPullRequestContext';
import { autoMergeIfPossible } from './autoMergeIfPossible';
import hasLabelInPR from './utils/hasLabelInPR';

export const autoApproveAndAutoMerge = async <
  E extends Webhooks.WebhookPayloadPullRequest
>(
  prContext: PrContext<E['pull_request']> | PrContext<Octokit.PullsGetResponse>,
  context: Context<E>,
): Promise<boolean> => {
  // const autoMergeLabel = repoContext.labels['merge/automerge'];
  const codeApprovedLabel = prContext.repoContext.labels['code/approved'];
  if (hasLabelInPR(prContext.pr.labels, codeApprovedLabel)) {
    await context.github.pulls.createReview(
      contextPr(context, { event: 'APPROVE' }),
    );
    await autoMergeIfPossible(prContext, context);
    return true;
  }

  return false;
};
