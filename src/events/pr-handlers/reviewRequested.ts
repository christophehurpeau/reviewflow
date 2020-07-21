import { Application } from 'probot';
import { AppContext } from '../../context/AppContext';
import * as slackUtils from '../../slack/utils';
import { createPullRequestHandler } from './utils/createPullRequestHandler';
import { updateReviewStatus } from './actions/updateReviewStatus';

export default function reviewRequested(
  app: Application,
  appContext: AppContext,
): void {
  app.on(
    'pull_request.review_requested',
    createPullRequestHandler(
      appContext,
      (payload) => payload.pull_request,
      async (prContext, context, repoContext): Promise<void> => {
        const { pr } = prContext;
        const sender = context.payload.sender;

        const reviewer = (context.payload as any).requested_reviewer;

        const reviewerGroup = repoContext.getReviewerGroup(reviewer.login);
        const shouldWait = false;
        // repoContext.approveShouldWait(reviewerGroup, pr.requested_reviewers, { includesWaitForGroups: true });

        if (reviewerGroup && repoContext.config.labels.review[reviewerGroup]) {
          await updateReviewStatus(prContext, context, reviewerGroup, {
            add: ['needsReview', !shouldWait && 'requested'],
            remove: ['approved'],
          });

          if (pr.assignees) {
            pr.assignees.forEach((assignee) => {
              repoContext.slack.updateHome(assignee.login);
            });
          }
          repoContext.slack.updateHome(reviewer.login);
        }

        if (sender.login === reviewer.login) return;

        if (!shouldWait && repoContext.slack) {
          const text = `:eyes: ${repoContext.slack.mention(
            sender.login,
          )} requests your review on ${slackUtils.createPrLink(
            pr,
            repoContext,
          )} !\n> ${pr.title}`;
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
              typeId: `${pr.id}_${reviewer.id}`,
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
