import Webhooks from '@octokit/webhooks';
import { Handler } from '../utils';

export const autoAssignPRToCreator: Handler<
  Webhooks.WebhookPayloadPullRequest
> = async (context, repoContext) => {
  if (!repoContext.config.autoAssignToCreator) return;

  const pr = context.payload.pull_request;
  if (pr.assignees.length !== 0) return;
  if (pr.user.type === 'Bot') return;

  await context.github.issues.addAssignees(
    context.issue({
      assignees: [pr.user.login],
    }),
  );
};
