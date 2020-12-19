import type { Probot } from 'probot';
import type { AppContext } from '../../context/AppContext';
import * as slackUtils from '../../slack/utils';
import { updateReviewStatus } from './actions/updateReviewStatus';
import { createPullRequestHandler } from './utils/createPullRequestHandler';

export default function reviewRequested(
  app: Probot,
  appContext: AppContext,
): void {
  app.on(
    'pull_request.review_requested',
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
        const shouldWait = false;
        // repoContext.approveShouldWait(reviewerGroup, pr.requested_reviewers, { includesWaitForGroups: true });

        if (
          !repoContext.shouldIgnore &&
          reviewerGroup &&
          repoContext.config.labels.review[reviewerGroup]
        ) {
          await updateReviewStatus(
            pullRequest,
            context,
            repoContext,
            reviewerGroup,
            {
              add: ['needsReview', !shouldWait && 'requested'],
              remove: ['approved'],
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

        if (!shouldWait && repoContext.slack) {
          const text = `:eyes: ${repoContext.slack.mention(
            sender.login,
          )} requests your review on ${slackUtils.createPrLink(
            pullRequest,
            repoContext,
          )} !\n> ${pullRequest.title}`;
          const message = { text };
          const result = await repoContext.slack.postMessage(
            'pr-review',
            reviewer.id,
            reviewer.login,
            message,
          );
          if (result) {
            await appContext.mongoStores.slackSentMessages.insertOne({
              type: 'review-requested',
              typeId: `${pullRequest.id}_${reviewer.id}`,
              message,
              account: repoContext.accountEmbed,
              sentTo: [result],
            });
          }
        }
      },
    ),
  );
}
