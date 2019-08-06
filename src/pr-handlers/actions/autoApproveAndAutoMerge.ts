import Webhooks from '@octokit/webhooks';
import { Context } from 'probot';
import { RepoContext } from '../../context/repoContext';
import { autoMergeIfPossible } from './autoMergeIfPossible';

export const autoApproveAndAutoMerge = async (
  context: Context<Webhooks.WebhookPayloadPullRequest>,
  repoContext: RepoContext,
): Promise<boolean> => {
  // const autoMergeLabel = repoContext.labels['merge/automerge'];
  const codeApprovedLabel = repoContext.labels['code/approved'];
  const prLabels = context.payload.pull_request.labels;
  if (prLabels.find((l): boolean => l.id === codeApprovedLabel.id)) {
    await context.github.pulls.createReview(
      context.issue({ event: 'APPROVE' }),
    );
    await autoMergeIfPossible(context, repoContext);
    return true;
  }

  return false;
};
