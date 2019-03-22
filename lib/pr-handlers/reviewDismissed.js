'use strict';

module.exports = async (repoContext, context) => {
  const sender = context.payload.sender;
  const pr = context.payload.pull_request;
  const reviewer = context.payload.review.user;

  const reviewerGroup = repoContext.getReviewerGroup(reviewer.login);

  if (reviewerGroup && repoContext.config.labels.review[reviewerGroup]) {
    const { data: reviews } = await context.github.pullRequests.listReviews(
      context.issue({ per_page: 50 })
    );
    const hasChangesRequestedInReviews = reviews.some(
      (review) =>
        repoContext.getReviewerGroup(review.user.login) === reviewerGroup &&
        review.state === 'REQUEST_CHANGES'
    );

    repoContext.updateReviewStatus(context, reviewerGroup, {
      add: ['needsReview', 'requested'],
      remove: [!hasChangesRequestedInReviews && 'changesRequested', 'approved'],
    });
  }

  if (sender.login === reviewer.login) {
    repoContext.slack.postMessage(
      pr.user.login,
      `:skull: ${repoContext.slack.mention(
        reviewer.login
      )} dismissed his review on ${pr.html_url}`
    );
  } else {
    repoContext.slack.postMessage(
      reviewer.login,
      `:skull: ${repoContext.slack.mention(
        sender.login
      )} dismissed your review on ${pr.html_url}`
    );
  }
};
