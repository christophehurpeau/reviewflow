import Webhooks from '@octokit/webhooks';
import { Context, Octokit } from 'probot';
import { AppContext } from '../../../context/AppContext';
import { RepoContext } from '../../../context/repoContext';
import { contextPr } from '../../../context/utils';
import { autoMergeIfPossible } from './autoMergeIfPossible';
import hasLabelInPR from './utils/hasLabelInPR';

export const autoApproveAndAutoMerge = async (
  appContext: AppContext,
  pr: Octokit.PullsGetResponse,
  context: Context<Webhooks.WebhookPayloadPullRequest>,
  repoContext: RepoContext,
): Promise<boolean> => {
  // const autoMergeLabel = repoContext.labels['merge/automerge'];
  const codeApprovedLabel = repoContext.labels['code/approved'];
  if (hasLabelInPR(pr.labels, codeApprovedLabel)) {
    await context.github.pulls.createReview(
      contextPr(context, { event: 'APPROVE' }),
    );
    await autoMergeIfPossible(appContext, pr, context, repoContext);
    return true;
  }

  return false;
};
