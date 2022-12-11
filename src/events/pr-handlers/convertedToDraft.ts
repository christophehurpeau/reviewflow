import type { Probot } from 'probot';
import type { AppContext } from '../../context/AppContext';
import * as slackUtils from '../../slack/utils';
import { editOpenedPR } from './actions/editOpenedPR';
import { updateReviewStatus } from './actions/updateReviewStatus';
import { updateStatusCheckFromStepsState } from './actions/updateStatusCheckFromStepsState';
import { calcStepsState } from './actions/utils/steps/calcStepsState';
import { createPullRequestHandler } from './utils/createPullRequestHandler';
import { getReviewersAndReviewStates } from './utils/getReviewersAndReviewStates';
import { getRolesFromPullRequestAndReviewers } from './utils/getRolesFromPullRequestAndReviewers';

export default function convertedToDraft(
  app: Probot,
  appContext: AppContext,
): void {
  createPullRequestHandler(
    app,
    appContext,
    'pull_request.converted_to_draft',
    (payload, context, repoContext) => {
      return payload.pull_request;
    },
    async (
      pullRequest,
      context,
      repoContext,
      reviewflowPrContext,
    ): Promise<void> => {
      /* if repo is not ignored */
      if (reviewflowPrContext) {
        await Promise.all([
          updateReviewStatus(pullRequest, context, repoContext, [
            {
              reviewGroup: 'dev',
              remove: ['needsReview'],
            },
          ]).then(async (newLabels) => {
            const stepsState = calcStepsState({
              repoContext,
              pullRequest,
              labels: newLabels,
            });

            await Promise.all([
              updateStatusCheckFromStepsState(
                stepsState,
                pullRequest,
                context,
                appContext,
                reviewflowPrContext,
              ),
              editOpenedPR({
                pullRequest,
                context,
                appContext,
                repoContext,
                reviewflowPrContext,
                stepsState,
                shouldUpdateCommentBodyInfos: true,
                shouldUpdateCommentBodyProgress: true,
              }),
            ]);
          }),
        ]);
      }

      const sender = context.payload.sender;

      const { reviewers } = await getReviewersAndReviewStates(
        context,
        repoContext,
      );
      const { owner, assignees, followers } =
        getRolesFromPullRequestAndReviewers(pullRequest, reviewers, {
          excludeIds: [sender.id],
        });

      const mention = repoContext.slack.mention(sender.login);
      const prUrl = slackUtils.createPrLink(pullRequest, repoContext);
      const ownerMention = repoContext.slack.mention(owner.login);
      const createMessage = (
        toOwner?: boolean,
        isAssignedTo?: boolean,
      ): string => {
        const ownerPart = toOwner
          ? 'your PR'
          : `${sender.id === owner.id ? 'his' : `${ownerMention}'s`} PR${
              isAssignedTo ? " you're assigned to" : ''
            }`;

        return `:ghost: ${mention} marked ${ownerPart} ${prUrl} as draft`;
      };

      const messageToOwner = { text: createMessage(true, true) };
      const messageToAssignee = { text: createMessage(false, true) };
      const messageToFollower = { text: createMessage(false) };

      await Promise.all([
        ...assignees
          .filter((assignee) => assignee.id === owner.id)
          .map((assigneeIsOwner) => {
            return repoContext.slack.postMessage(
              'pr-lifecycle',
              assigneeIsOwner,
              messageToOwner,
            );
          }),

        ...assignees
          .filter((assignee) => assignee.id !== owner.id)
          .map((assignee) => {
            return repoContext.slack.postMessage(
              'pr-lifecycle',
              assignee,
              messageToAssignee,
            );
          }),

        ...followers.map((follower) => {
          return repoContext.slack.postMessage(
            'pr-lifecycle-follow',
            follower,
            messageToFollower,
          );
        }),
      ]);
    },
  );
}
