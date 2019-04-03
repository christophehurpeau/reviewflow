import { Application } from 'probot';
import { createHandlerPullRequestChange } from './utils';
import { updateReviewStatus } from './actions/updateReviewStatus';

export default (app: Application) => {
  app.on(
    'pull_request.review_request_removed',
    createHandlerPullRequestChange(async (context, repoContext) => {
      const sender = context.payload.sender;
      const pr = context.payload.pull_request;
      const reviewer = (context.payload as any).requested_reviewer;

      const reviewerGroup = repoContext.getReviewerGroup(reviewer.login);

      if (reviewerGroup && repoContext.config.labels.review[reviewerGroup]) {
        const hasRequestedReviewsForGroup = repoContext.reviewShouldWait(
          reviewerGroup,
          pr.requested_reviewers,
          {
            includesReviewerGroup: true,
          },
        );

        const { data: reviews } = await context.github.pulls.listReviews(
          context.issue({ per_page: 50 }),
        );

        const hasChangesRequestedInReviews = reviews.some(
          (review) =>
            repoContext.getReviewerGroup(review.user.login) === reviewerGroup &&
            review.state === 'REQUEST_CHANGES',
        );

        const hasApprovedInReviews = reviews.some(
          (review) =>
            repoContext.getReviewerGroup(review.user.login) === reviewerGroup &&
            review.state === 'APPROVED',
        );

        const approved =
          !hasRequestedReviewsForGroup &&
          !hasChangesRequestedInReviews &&
          hasApprovedInReviews;
        await updateReviewStatus(context, repoContext, reviewerGroup, {
          add: [
            // if changes requested by the one which requests was removed
            hasChangesRequestedInReviews && 'changesRequested',
            // if was already approved by another member in the group and has no other requests waiting
            approved && 'approved',
          ],
          // remove labels if has no other requests waiting
          remove: [
            approved && 'needsReview',
            !hasRequestedReviewsForGroup &&
              !hasChangesRequestedInReviews &&
              'requested',
          ],
        });
      }

      if (sender.login === reviewer.login) return;

      if (repoContext.slack) {
        repoContext.slack.postMessage(
          reviewer.login,
          `:skull_and_crossbones: ${repoContext.slack.mention(
            sender.login,
          )} removed the request for your review on ${pr.html_url}`,
        );
      }
    }),
  );
};
