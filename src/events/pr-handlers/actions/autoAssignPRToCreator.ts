import Webhooks from '@octokit/webhooks';
import { Context, Octokit } from 'probot';
import { contextIssue } from '../../../context/utils';
import { PrContext } from '../utils/createPullRequestContext';

export const autoAssignPRToCreator = async <
  E extends Webhooks.WebhookPayloadPullRequest
>(
  prContext: PrContext<E['pull_request'] | Octokit.PullsGetResponse>,
  context: Context<E>,
): Promise<void> => {
  const { pr, repoContext } = prContext;
  if (!repoContext.config.autoAssignToCreator) return;
  if (pr.assignees.length !== 0) return;
  if (pr.user.type === 'Bot') return;

  await context.github.issues.addAssignees(
    contextIssue(context, {
      assignees: [pr.user.login],
    }),
  );
};
