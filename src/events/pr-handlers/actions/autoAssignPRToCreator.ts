import type { EventPayloads } from '@octokit/webhooks';
import type { Context } from 'probot';
import type { RepoContext } from 'context/repoContext';
import type { PullRequestFromRestEndpoint } from '../utils/PullRequestData';

export const autoAssignPRToCreator = async <
  E extends EventPayloads.WebhookPayloadPullRequest
>(
  pullRequest: E['pull_request'] | PullRequestFromRestEndpoint,
  context: Context<E>,
  repoContext: RepoContext,
): Promise<void> => {
  if (!repoContext.config.autoAssignToCreator) return;
  if (!pullRequest.assignees || pullRequest.assignees.length > 0) return;
  if (!pullRequest.user || pullRequest.user.type === 'Bot') return;

  await context.octokit.issues.addAssignees(
    context.issue({
      assignees: [pullRequest.user.login],
    }),
  );
};
