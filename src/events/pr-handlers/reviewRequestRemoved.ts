import type { Probot } from 'probot';
import type { AppContext } from '../../context/AppContext';
import * as slackUtils from '../../slack/utils';
import { updateReviewStatus } from './actions/updateReviewStatus';
import { createPullRequestHandler } from './utils/createPullRequestHandler';
import { getReviewersAndReviewStates } from './utils/getReviewersAndReviewStates';

export default function reviewRequestRemoved(
  app: Probot,
  appContext: AppContext,
): void {
  app.on(
    'pull_request.review_request_removed',
    createPullRequestHandler(
      appContext,
      (payload) => payload.pull_request,
      async (
        pullRequest,
        context,
        repoContext,
        reviewflowPrContext,
      ): Promise<void> => {
        const sender = context.payload.sender;
        const requestedReviewer = (context.payload as any).requested_reviewer;
        const requestedTeam = (context.payload as any).requested_team;
        const requestedReviewers = requestedReviewer
          ? [requestedReviewer]
          : await repoContext.getMembersForTeam(requestedTeam.id);

        const reviewerGroup = requestedReviewer
          ? repoContext.getReviewerGroup(requestedReviewer.login)
          : repoContext.getTeamGroup(requestedTeam.name);

        if (
          !repoContext.shouldIgnore &&
          reviewerGroup &&
          repoContext.config.labels.review[reviewerGroup]
        ) {
          const hasRequestedReviewsForGroup = repoContext.approveShouldWait(
            reviewerGroup,
            pullRequest,
            {
              includesReviewerGroup: true,
            },
          );

          const { reviewStates } = await getReviewersAndReviewStates(
            context,
            repoContext,
          );

          const hasChangesRequestedInReviews =
            reviewStates[reviewerGroup].changesRequested !== 0;

          const hasApprovedInReviews =
            reviewStates[reviewerGroup].approved !== 0;

          const approved =
            !hasRequestedReviewsForGroup &&
            !hasChangesRequestedInReviews &&
            hasApprovedInReviews;

          await updateReviewStatus(
            pullRequest,
            context,
            repoContext,
            reviewerGroup,
            {
              add: [
                // if changes requested by the one which requests was removed (should still be in changed requested anyway, but we never know)
                hasChangesRequestedInReviews && 'changesRequested',
                // if was already approved by another member in the group and has no other requests waiting
                approved && 'approved',
              ],
              // remove labels if has no other requests waiting
              remove: [
                approved && 'needsReview',
                !hasRequestedReviewsForGroup && 'requested',
              ],
            },
          );

          const assigneesLogins: string[] = [];
          if (pullRequest.assignees) {
            pullRequest.assignees.forEach((assignee) => {
              assigneesLogins.push(assignee.login);
              repoContext.slack.updateHome(assignee.login);
            });
          }

          requestedReviewers.forEach((potentialReviewer) => {
            if (assigneesLogins.includes(potentialReviewer)) return;
            repoContext.slack.updateHome(potentialReviewer.login);
          });
        }

        if (repoContext.slack) {
          if (requestedReviewers.some((rr) => rr.login === sender.login)) {
            requestedReviewers.forEach((potentialReviewer) => {
              if (potentialReviewer.login === sender.login) return;
              repoContext.slack.postMessage(
                'pr-review',
                potentialReviewer.id,
                potentialReviewer.login,
                {
                  text: `:skull_and_crossbones: ${repoContext.slack.mention(
                    sender.login,
                  )} removed the request for your team _${
                    requestedTeam.name
                  }_ review on ${slackUtils.createPrLink(
                    pullRequest,
                    repoContext,
                  )}`,
                },
              );
            });
          } else {
            requestedReviewers.forEach((potentialReviewer) => {
              repoContext.slack.postMessage(
                'pr-review',
                potentialReviewer.id,
                potentialReviewer.login,
                {
                  text: `:skull_and_crossbones: ${repoContext.slack.mention(
                    sender.login,
                  )} removed the request for  ${
                    requestedTeam ? `your team _${requestedTeam.name}_` : 'your'
                  } review on ${slackUtils.createPrLink(
                    pullRequest,
                    repoContext,
                  )}`,
                },
              );
            });
          }

          await Promise.all(
            requestedReviewers.map(async (potentialReviewer) => {
              const sentMessageRequestedReview =
                await appContext.mongoStores.slackSentMessages.findOne({
                  'account.id': repoContext.accountEmbed.id,
                  'account.type': repoContext.accountEmbed.type,
                  type: 'review-requested',
                  typeId: `${pullRequest.id}_${
                    requestedTeam ? `${requestedTeam.id}_` : ''
                  }${potentialReviewer.id}`,
                });

              if (sentMessageRequestedReview) {
                const sentTo = sentMessageRequestedReview.sentTo[0];
                const message = sentMessageRequestedReview.message;
                await Promise.all([
                  repoContext.slack.updateMessage(sentTo.ts, sentTo.channel, {
                    ...message,
                    text: message.text
                      .split('\n')
                      .map((l) => `~${l}~`)
                      .join('\n'),
                  }),
                  repoContext.slack.addReaction(
                    sentTo.ts,
                    sentTo.channel,
                    'skull_and_crossbones',
                  ),
                  appContext.mongoStores.slackSentMessages.deleteOne(
                    sentMessageRequestedReview,
                  ),
                ]);
              }
            }),
          );
        }
      },
    ),
  );
}
