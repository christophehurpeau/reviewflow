import { Application } from 'probot';
import { MongoStores } from '../mongo';
import { contextPr } from '../context/utils';
import { createHandlerPullRequestChange } from './utils';
import { updateReviewStatus } from './actions/updateReviewStatus';

export default function reviewDismissed(
  app: Application,
  mongoStores: MongoStores,
): void {
  app.on(
    'pull_request_review.dismissed',
    createHandlerPullRequestChange(
      mongoStores,
      async (pr, context, repoContext): Promise<void> => {
        const sender = context.payload.sender;
        const reviewer = (context.payload as any).review.user;

        const reviewerGroup = repoContext.getReviewerGroup(reviewer.login);

        if (reviewerGroup && repoContext.config.labels.review[reviewerGroup]) {
          const { data: reviews } = await context.github.pulls.listReviews(
            contextPr(context, { per_page: 50 }),
          );
          const hasChangesRequestedInReviews = reviews.some(
            (review) =>
              repoContext.getReviewerGroup(review.user.login) ===
                reviewerGroup && review.state === 'REQUEST_CHANGES',
          );

          await updateReviewStatus(pr, context, repoContext, reviewerGroup, {
            add: ['needsReview', 'requested'],
            remove: [
              !hasChangesRequestedInReviews && 'changesRequested',
              'approved',
            ],
          });
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
