import { Application } from 'probot';
import { AppContext } from '../../context/AppContext';
import * as slackUtils from '../../slack/utils';
import { createPullRequestHandler } from './utils/createPullRequestHandler';
import { updateReviewStatus } from './actions/updateReviewStatus';
import { getReviewersAndReviewStates } from './utils/getReviewersAndReviewStates';

export default function reviewRequestRemoved(
  app: Application,
  appContext: AppContext,
): void {
  app.on(
    'pull_request.review_request_removed',
    createPullRequestHandler(
      appContext,
      (payload) => payload.pull_request,
      async (prContext, context, repoContext): Promise<void> => {
        const { pr } = prContext;
        const sender = context.payload.sender;
        const reviewer = (context.payload as any).requested_reviewer;

        const reviewerGroup = repoContext.getReviewerGroup(reviewer.login);

        if (reviewerGroup && repoContext.config.labels.review[reviewerGroup]) {
          const hasRequestedReviewsForGroup = repoContext.approveShouldWait(
            reviewerGroup,
            pr.requested_reviewers,
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

          await updateReviewStatus(prContext, context, reviewerGroup, {
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
          });

          if (pr.assignees) {
            pr.assignees.forEach((assignee) => {
              repoContext.slack.updateHome(assignee.login);
            });
          }
          repoContext.slack.updateHome(reviewer.login);
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
              pr,
              repoContext,
            )}`,
          },
        );

        const sentMessageRequestedReview = await appContext.mongoStores.slackSentMessages.findOne(
          {
            'account.id': repoContext.account._id,
            'account.type': repoContext.accountType,
            type: 'review-requested',
            typeId: `${pr.id}_${reviewer.id}`,
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
