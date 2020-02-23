import Webhooks from '@octokit/webhooks';
import { Context, Octokit } from 'probot';
import { RepoContext } from '../../context/repoContext';
import { autoMergeIfPossible } from './autoMergeIfPossible';
import hasLabelInPR from './utils/hasLabelInPR';

export const autoApproveAndAutoMerge = async (
  pr: Octokit.PullsGetResponse,
  context: Context<Webhooks.WebhookPayloadPullRequest>,
  repoContext: RepoContext,
): Promise<boolean> => {
  // const autoMergeLabel = repoContext.labels['merge/automerge'];
  const codeApprovedLabel = repoContext.labels['code/approved'];
  if (hasLabelInPR(pr.labels, codeApprovedLabel)) {
    await context.github.pulls.createReview(
      context.issue({ event: 'APPROVE' }),
    );
    await autoMergeIfPossible(pr, context, repoContext);
    return true;
  }

  return false;
};
