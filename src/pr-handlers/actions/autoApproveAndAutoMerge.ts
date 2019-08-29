import Webhooks from '@octokit/webhooks';
import { PullsGetResponse } from '@octokit/rest';
import { Context } from 'probot';
import { RepoContext } from '../../context/repoContext';
import { autoMergeIfPossible } from './autoMergeIfPossible';
import hasLabelInPR from './utils/hasLabelInPR';

export const autoApproveAndAutoMerge = async (
  pr: PullsGetResponse,
  context: Context<Webhooks.WebhookPayloadPullRequest>,
  repoContext: RepoContext,
): Promise<boolean> => {
  // const autoMergeLabel = repoContext.labels['merge/automerge'];
  const codeApprovedLabel = repoContext.labels['code/approved'];
  if (hasLabelInPR(pr, codeApprovedLabel)) {
    await context.github.pulls.createReview(
      context.issue({ event: 'APPROVE' }),
    );
    await autoMergeIfPossible(pr, context, repoContext);
    return true;
  }

  return false;
};
