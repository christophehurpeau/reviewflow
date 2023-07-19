import type { EmitterWebhookEventName } from '@octokit/webhooks';
import type { RepoContext } from '../../../context/repoContext';
import type { ProbotEvent } from '../../probot-types';
import type { PullRequestWithDecentData } from '../utils/PullRequestData';

export const autoAssignPRToCreator = async <
  Name extends EmitterWebhookEventName,
>(
  pullRequest: PullRequestWithDecentData,
  context: ProbotEvent<Name>,
  repoContext: RepoContext,
): Promise<void> => {
  if (!repoContext.config.autoAssignToCreator) return;
  if (!pullRequest.assignees || pullRequest.assignees.length > 0) return;
  if (!pullRequest.user) return;

  // don't assign pr from forks
  if (pullRequest.head.repo?.full_name !== pullRequest.base.repo.full_name) {
    return;
  }

  await context.octokit.issues.addAssignees(
    context.issue({
      assignees: [pullRequest.user.login],
    }),
  );
};
