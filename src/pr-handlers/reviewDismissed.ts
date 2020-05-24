import { Application } from 'probot';
import { AppContext } from '../context/AppContext';
import { createHandlerPullRequestChange } from './utils';
import { updateReviewStatus } from './actions/updateReviewStatus';
import { getReviewersAndReviewStates } from './utils/getReviewersAndReviewStates';

export default function reviewDismissed(
  app: Application,
  appContext: AppContext,
): void {
  app.on(
    'pull_request_review.dismissed',
    createHandlerPullRequestChange(
      appContext,
      { refetchPr: true },
      async (pr, context, repoContext): Promise<void> => {
        const sender = context.payload.sender;
        const reviewer = (context.payload as any).review.user;

        const reviewerGroup = repoContext.getReviewerGroup(reviewer.login);

        if (reviewerGroup && repoContext.config.labels.review[reviewerGroup]) {
          const { reviewStates } = await getReviewersAndReviewStates(
            context,
            repoContext,
          );
          const hasChangesRequestedInReviews =
            reviewStates[reviewerGroup].changesRequested !== 0;
          const hasApprovals = reviewStates[reviewerGroup].approved !== 0;
          const hasRequestedReviewsForGroup = repoContext.approveShouldWait(
            reviewerGroup,
            pr.requested_reviewers,
            { includesReviewerGroup: true },
          );

          await updateReviewStatus(pr, context, repoContext, reviewerGroup, {
            add: [
              !hasApprovals && 'needsReview',
              hasApprovals &&
                !hasRequestedReviewsForGroup &&
                !hasChangesRequestedInReviews &&
                'approved',
            ],
            remove: [
              !hasRequestedReviewsForGroup &&
                !hasChangesRequestedInReviews &&
                'requested',
              !hasChangesRequestedInReviews && 'changesRequested',
              !hasApprovals && 'approved',
            ],
          });

          repoContext.slack.updateHome(pr.user.login);
          repoContext.slack.updateHome(reviewer.login);
        }

        if (repoContext.slack) {
          if (sender.login === reviewer.login) {
            repoContext.slack.postMessage(
              'pr-review',
              pr.user.id,
              pr.user.login,
              {
                text: `:skull: ${repoContext.slack.mention(
                  reviewer.login,
                )} dismissed his review on ${repoContext.slack.prLink(
                  pr,
                  context,
                )}`,
              },
            );
          } else {
            repoContext.slack.postMessage(
              'pr-review',
              reviewer.id,
              reviewer.login,
              {
                text: `:skull: ${repoContext.slack.mention(
                  sender.login,
                )} dismissed your review on ${repoContext.slack.prLink(
                  pr,
                  context,
                )}`,
              },
            );
          }
        }
      },
    ),
  );
}
