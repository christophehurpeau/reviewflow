import { Application } from 'probot';
import { createHandlerPullRequestChange } from './utils';

export default (app: Application) => {
  app.on(
    'pull_request_review.submitted',
    createHandlerPullRequestChange(async (context, repoContext) => {
      const pr = context.payload.pull_request;
      const { user: reviewer, state } = (context.payload as any).review;
      if (pr.user.login === reviewer.login) return;

      const reviewerGroup = repoContext.getReviewerGroup(reviewer.login);

      if (reviewerGroup && repoContext.config.labels.review[reviewerGroup]) {
        const hasRequestedReviewsForGroup = repoContext.reviewShouldWait(
          reviewerGroup,
          pr.requested_reviewers,
          {
            includesReviewerGroup: true,
            // TODO reenable this when accepted can notify request review to slack (dev accepted => design requested) and flag to disable for label (approved design ; still waiting for dev ?)
            // includesWaitForGroups: true,
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

        const approved =
          !hasRequestedReviewsForGroup &&
          !hasChangesRequestedInReviews &&
          state === 'approved';

        await repoContext.updateReviewStatus(context, reviewerGroup, {
          add: [
            approved && 'approved',
            state === 'changes_requested' && 'changesRequested',
          ],
          remove: [
            approved && 'needsReview',
            !(hasRequestedReviewsForGroup || state === 'changes_requested') &&
              'requested',
            state === 'approved' &&
              !hasChangesRequestedInReviews &&
              'changesRequested',
            state === 'changes_requested' && 'approved',
          ],
        });
      }

      const mention = repoContext.slack.mention(reviewer.login);
      const prUrl = pr.html_url;

      const message = (() => {
        if (state === 'changes_requested') {
          return `:x: ${mention} requests changes on ${prUrl}`;
        }
        if (state === 'approved') {
          return `:clap: :white_check_mark: ${mention} approves ${prUrl}`;
        }
        return `:speech_balloon: ${mention} commented on ${prUrl}`;
      })();

      repoContext.slack.postMessage(pr.user.login, message);
    }),
  );
};
