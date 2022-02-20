import type { Probot } from 'probot';
import type { AppContext } from '../../context/AppContext';
import * as slackUtils from '../../slack/utils';
import { createPullRequestHandler } from './utils/createPullRequestHandler';

export default function assignedOrUnassignedHandler(
  app: Probot,
  appContext: AppContext,
): void {
  createPullRequestHandler(
    app,
    appContext,
    ['pull_request.assigned', 'pull_request.unassigned'],
    (payload, context, repoContext) => {
      return payload.pull_request;
    },
    async (
      pullRequest,
      context,
      repoContext,
      reviewflowPrContext,
    ): Promise<void> => {
      const { assignee: newlyAssigned, sender } = context.payload;
      const isUnassigned = context.payload.action === 'unassigned';

      /* if repo is not ignored */
      if (reviewflowPrContext) {
        // update new assignee slack home
        repoContext.slack.updateHome(newlyAssigned.login);
      }

      if (repoContext.slack) {
        await Promise.all(
          [
            ...pullRequest.assignees,
            ...(pullRequest.assignees.some((a) => a.id === pullRequest.user.id)
              ? []
              : [pullRequest.user]),
          ].map((assigneeOrOwner) => {
            if (assigneeOrOwner.id === sender.id) return;
            return repoContext.slack.postMessage('pr-review', assigneeOrOwner, {
              text: `${
                isUnassigned ? ':man-gesturing-no:' : ':man-raising-hand:'
              } ${repoContext.slack.mention(sender.login)} ${
                isUnassigned ? 'unassigned' : 'assigned'
              } ${
                sender.login === newlyAssigned.login
                  ? 'himself'
                  : newlyAssigned.id === assigneeOrOwner.id
                  ? 'you'
                  : repoContext.slack.mention(newlyAssigned.login)
              } on ${slackUtils.createPrLink(pullRequest, repoContext)}`,
            });
          }),
        );
      }
    },
  );
}
