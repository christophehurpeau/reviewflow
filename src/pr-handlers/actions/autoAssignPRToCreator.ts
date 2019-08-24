import Webhooks from '@octokit/webhooks';
import { PRHandler } from '../utils';

export const autoAssignPRToCreator: PRHandler<
  Webhooks.WebhookPayloadPullRequest
> = async (pr, context, repoContext) => {
  if (!repoContext.config.autoAssignToCreator) return;
  if (pr.assignees.length !== 0) return;
  if (pr.user.type === 'Bot') return;

  await context.github.issues.addAssignees(
    context.issue({
      assignees: [pr.user.login],
    }),
  );
};
