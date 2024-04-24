import type { Probot } from 'probot';
import type { AppContext } from '../../context/AppContext';
import * as slackUtils from '../../slack/utils';
import { checkIfIsThisBot } from '../../utils/github/isBotUser';
import { updateSlackHomeForPr } from './actions/utils/updateSlackHome';
import { toBasicUser } from './utils/PullRequestData';
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
      if (checkIfIsThisBot(payload.sender)) {
        // ignore assigned from this bot
        return null;
      }

      if (payload.pull_request.closed_at) {
        // ignore notifications for assigned/unassigned if pr is closed or merged
        return null;
      }
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

      if (reviewflowPrContext) {
        await appContext.mongoStores.prs.partialUpdateOne(
          reviewflowPrContext.reviewflowPr,
          {
            $set: {
              assignees: pullRequest.assignees.map(toBasicUser),
            },
          },
        );
      }

      if (repoContext.slack) {
        updateSlackHomeForPr(repoContext, pullRequest, {
          otherLogins: [newlyAssigned.login],
        });

        await Promise.all(
          [
            ...pullRequest.assignees,
            ...(pullRequest.assignees.some((a) => a.id === pullRequest.user.id)
              ? []
              : [pullRequest.user]),
          ].map((assigneeOrOwner) => {
            if (assigneeOrOwner.id === sender.id) return undefined;
            return repoContext.slack.postMessage('pr-review', assigneeOrOwner, {
              text: `${
                isUnassigned ? ':man-gesturing-no:' : ':man-raising-hand:'
              } ${repoContext.slack.mention(sender.login)} ${
                isUnassigned ? 'unassigned' : 'assigned'
              } ${(() => {
                if (sender.login === newlyAssigned.login) return 'himself';
                return newlyAssigned.id === assigneeOrOwner.id
                  ? 'you'
                  : repoContext.slack.mention(newlyAssigned.login);
              })()} on ${slackUtils.createPrLink(pullRequest, repoContext)}`,
            });
          }),
        );
      }
    },
  );
}
