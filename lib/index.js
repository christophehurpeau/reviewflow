/* eslint-disable max-lines */

'use strict';

const { obtainRepoContext } = require('./context/repoContext');
const config = require('./teamconfig');

// const getConfig = require('probot-config')
// const { MongoClient } = require('mongodb');

// const connect = MongoClient.connect(process.env.MONGO_URL);
// const db = connect.then(client => client.db(process.env.MONGO_DB));

// let config = await getConfig(context, 'reviewflow.yml');

/*
 * This is the entry point for your Probot App.
 * @param {import('probot').Application} app - Probot's Application class.
 */
module.exports = (app) => {
  const autoAssignToCreator = (repoContext, context) => {
    if (!repoContext.config.autoAssignToCreator) return;

    const pr = context.payload.pull_request;
    if (pr.assignees.length !== 0) return;

    return context.github.issues.addAssigneesToIssue(
      context.issue({
        assignees: [pr.user.login],
      })
    );
  };

  const editOpenedPr = (repoContext, context) => {
    if (!repoContext.config.trimTitle) return;

    const pr = context.payload.pull_request;
    const title = pr.title
      .trim()
      .replace(/[\s-]+\[?\s*(ONK-\d+)\s*]?\s*$/, ' $1');

    if (pr.title !== title) {
      context.github.issues.update(
        context.issue({
          title,
        })
      );
    }
  };

  app.on('pull_request.opened', async (context) => {
    const repoContext = await obtainRepoContext(context);
    if (!repoContext) return;

    await Promise.all([
      autoAssignToCreator(repoContext, context),
      editOpenedPr(repoContext, context),
    ]);
  });

  app.on('pull_request.review_requested', async (context) => {
    const repoContext = await obtainRepoContext(context);
    if (!repoContext) return;
    const sender = context.payload.sender;

    // ignore if sender is self (dismissed review rerequest review)
    if (sender.type === 'Bot') return;

    const pr = context.payload.pull_request;
    const reviewer = context.payload.requested_reviewer;

    const reviewerGroup = repoContext.getReviewerGroup(reviewer.login);
    const shouldWait = false;
    // repoContext.reviewShouldWait(reviewerGroup, pr.requested_reviewers, { includesWaitForGroups: true });

    if (config.labels.review[reviewerGroup]) {
      const { data: reviews } = await context.github.pullRequests.listReviews(
        context.issue({ per_page: 50 })
      );
      const hasChangesRequestedInReviews = reviews.some(
        (review) =>
          repoContext.getReviewerGroup(review.user.login) === reviewerGroup &&
          review.state === 'REQUEST_CHANGES' &&
          // In case this is a rerequest for review
          review.user.login !== reviewer.login
      );

      if (!hasChangesRequestedInReviews) {
        repoContext.updateReviewStatus(context, reviewerGroup, {
          add: ['needsReview', !shouldWait && 'requested'],
          remove: ['approved', 'changesRequested'],
        });
      }
    }

    if (sender.login === reviewer.login) return;

    if (!shouldWait) {
      repoContext.slack.postMessage(
        reviewer.login,
        `:eyes: ${repoContext.slack.mention(
          sender.login
        )} requests your review on ${pr.html_url} !\n> ${pr.title}`
      );
    }
  });

  app.on('pull_request.review_request_removed', async (context) => {
    const repoContext = await obtainRepoContext(context);
    if (!repoContext) return;
    const sender = context.payload.sender;
    const pr = context.payload.pull_request;
    const reviewer = context.payload.requested_reviewer;

    const reviewerGroup = repoContext.getReviewerGroup(reviewer.login);

    const hasRequestedReviewsForGroup = repoContext.reviewShouldWait(
      reviewerGroup,
      pr.requested_reviewers,
      {
        includesReviewerGroup: true,
      }
    );

    if (config.labels.review[reviewerGroup]) {
      const { data: reviews } = await context.github.pullRequests.listReviews(
        context.issue({ per_page: 50 })
      );

      const hasChangesRequestedInReviews = reviews.some(
        (review) =>
          repoContext.getReviewerGroup(review.user.login) === reviewerGroup &&
          review.state === 'REQUEST_CHANGES'
      );

      const hasApprovedInReviews = reviews.some(
        (review) =>
          repoContext.getReviewerGroup(review.user.login) === reviewerGroup &&
          review.state === 'APPROVED'
      );

      const approved =
        !hasRequestedReviewsForGroup &&
        !hasChangesRequestedInReviews &&
        hasApprovedInReviews;
      repoContext.updateReviewStatus(context, reviewerGroup, {
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

    repoContext.slack.postMessage(
      reviewer.login,
      `:skull_and_crossbones: ${repoContext.slack.mention(
        sender.login
      )} removed the request for your review on ${pr.html_url}`
    );
  });

  // app.on('pull_request.closed', async context => {

  // });

  // app.on('pull_request.reopened', async context => {

  // });

  app.on('pull_request_review.submitted', async (context) => {
    const repoContext = await obtainRepoContext(context);
    if (!repoContext) return;
    const pr = context.payload.pull_request;
    const { user: reviewer, state } = context.payload.review;
    if (pr.user.login === reviewer.login) return;

    const reviewerGroup = repoContext.getReviewerGroup(reviewer.login);

    if (reviewerGroup && config.labels.review[reviewerGroup]) {
      const hasRequestedReviewsForGroup = repoContext.reviewShouldWait(
        reviewerGroup,
        pr.requested_reviewers,
        {
          includesReviewerGroup: true,
          // TODO reenable this when accepted can notify request review to slack (dev accepted => design requested) and flag to disable for label (approved design ; still waiting for dev ?)
          // includesWaitForGroups: true,
        }
      );
      const { data: reviews } = await context.github.pullRequests.listReviews(
        context.issue({ per_page: 50 })
      );
      const hasChangesRequestedInReviews = reviews.some(
        (review) =>
          repoContext.getReviewerGroup(review.user.login) === reviewerGroup &&
          review.state === 'REQUEST_CHANGES'
      );

      const approved =
        !hasRequestedReviewsForGroup &&
        !hasChangesRequestedInReviews &&
        state === 'approved';
      repoContext.updateReviewStatus(context, reviewerGroup, {
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
  });

  app.on('pull_request_review.dismissed', async (context) => {
    const repoContext = await obtainRepoContext(context);
    if (!repoContext) return;
    const sender = context.payload.sender;
    const pr = context.payload.pull_request;
    const reviewer = context.payload.review.user;

    const reviewerGroup = repoContext.getReviewerGroup(reviewer.login);

    if (reviewerGroup && config.labels.review[reviewerGroup]) {
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
        remove: [
          !hasChangesRequestedInReviews && 'changesRequested',
          'approved',
        ],
      });
    }

    context.github.pullRequests.createReviewRequest(
      context.issue({
        reviewers: [reviewer.login],
      })
    );

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
        `:eyes: ${repoContext.slack.mention(
          sender.login
        )} dismissed your review on ${pr.html_url}, he requests a new one !`
      );
    }
  });

  app.on(
    ['pull_request.labeled', 'pull_request.unlabeled'],
    async (context) => {
      const sender = context.payload.sender;
      if (sender.type === 'Bot') return;

      const repoContext = await obtainRepoContext(context);
      if (!repoContext) return;

      await repoContext.updateStatusCheckFromLabels(context);
    }
  );

  app.on('pull_request.synchronize', async (context) => {
    const repoContext = await obtainRepoContext(context);
    if (!repoContext) return;

    await Promise.all([
      editOpenedPr(repoContext, context),
      repoContext.addStatusCheckToLatestCommit(context),
    ]);
  });

  app.on('pull_request.edited', async (context) => {
    const repoContext = await obtainRepoContext(context);
    if (!repoContext) return;

    await editOpenedPr(repoContext, context);
  });
};
