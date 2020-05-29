import { Application } from 'probot';
import { AppContext } from '../../context/AppContext';
import * as slackUtils from '../../slack/utils';
import { createHandlerPullRequestChange } from './utils';
import { updateReviewStatus } from './actions/updateReviewStatus';

export default function reviewRequested(
  app: Application,
  appContext: AppContext,
): void {
  app.on(
    'pull_request.review_requested',
    createHandlerPullRequestChange(
      appContext,
      { refetchPr: true },
      async (pr, context, repoContext): Promise<void> => {
        const sender = context.payload.sender;

        const reviewer = (context.payload as any).requested_reviewer;

        const reviewerGroup = repoContext.getReviewerGroup(reviewer.login);
        const shouldWait = false;
        // repoContext.approveShouldWait(reviewerGroup, pr.requested_reviewers, { includesWaitForGroups: true });

        if (reviewerGroup && repoContext.config.labels.review[reviewerGroup]) {
          await updateReviewStatus(pr, context, repoContext, reviewerGroup, {
            add: ['needsReview', !shouldWait && 'requested'],
            remove: ['approved'],
          });

          repoContext.slack.updateHome(pr.user.login);
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
