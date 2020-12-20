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
        const reviewer = (context.payload as any).requested_reviewer;

        const reviewerGroup = repoContext.getReviewerGroup(reviewer.login);

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

          if (pullRequest.assignees) {
            pullRequest.assignees.forEach((assignee) => {
              repoContext.slack.updateHome(assignee.login);
            });
          }
          if (
            !pullRequest.assignees.find(
              (assignee) => assignee.login === reviewer.login,
            )
          ) {
            repoContext.slack.updateHome(reviewer.login);
          }
        }

        if (sender.login === reviewer.login) return;

        repoContext.slack.postMessage(
          'pr-review',
          reviewer.id,
          reviewer.login,
          {
            text: `:skull_and_crossbones: ${repoContext.slack.mention(
              sender.login,
            )} removed the request for your review on ${slackUtils.createPrLink(
              pullRequest,
              repoContext,
            )}`,
          },
        );

        const sentMessageRequestedReview = await appContext.mongoStores.slackSentMessages.findOne(
          {
            'account.id': repoContext.account._id,
            'account.type': repoContext.accountType,
            type: 'review-requested',
            typeId: `${pullRequest.id}_${reviewer.id}`,
          },
        );

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
      },
    ),
  );
}
