import { Application } from 'probot';
import { MongoStores } from '../mongo';
import { createHandlerPullRequestChange } from './utils';
import { updateReviewStatus } from './actions/updateReviewStatus';
import { getReviewersAndReviewStates } from './utils/getReviewersAndReviewStates';

export default function reviewRequestRemoved(
  app: Application,
  mongoStores: MongoStores,
): void {
  app.on(
    'pull_request.review_request_removed',
    createHandlerPullRequestChange(
      mongoStores,
      async (pr, context, repoContext): Promise<void> => {
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

          await updateReviewStatus(pr, context, repoContext, reviewerGroup, {
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

          repoContext.slack.updateHome(pr.user.login);
          repoContext.slack.updateHome(reviewer.login);
        }

        if (sender.login === reviewer.login) return;

        if (repoContext.slack) {
          repoContext.slack.postMessage(
            'pr-review',
            reviewer.id,
            reviewer.login,
            {
              text: `:skull_and_crossbones: ${repoContext.slack.mention(
                sender.login,
              )} removed the request for your review on ${repoContext.slack.prLink(
                pr,
                context,
              )}`,
            },
          );
        }
      },
    ),
  );
}
