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

        const requestedReviewer = (context.payload as any).requested_reviewer;
        const requestedTeam = (context.payload as any).requested_team;
        const requestedReviewers = requestedReviewer
          ? [requestedReviewer]
          : await repoContext.getMembersForTeam(requestedTeam.slug);

        const reviewerGroup = requestedReviewer
          ? repoContext.getReviewerGroup(requestedReviewer.login)
          : repoContext.getTeamGroup(requestedTeam.name);
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

          const assigneesLogins: string[] = [];
          if (pullRequest.assignees) {
            pullRequest.assignees.forEach((assignee) => {
              assigneesLogins.push(assignee.login);
              repoContext.slack.updateHome(assignee.login);
            });
          }

          requestedReviewers.forEach((potentialReviewer) => {
            if (assigneesLogins.includes(potentialReviewer)) return;
            repoContext.slack.updateHome(potentialReviewer.login);
          });
        }

        if (!shouldWait && repoContext.slack) {
          const text = `:eyes: ${repoContext.slack.mention(
            sender.login,
          )} requests ${
            requestedReviewer ? 'your' : `your team _${requestedTeam.name}_`
          } review on ${slackUtils.createPrLink(
            pullRequest,
            repoContext,
          )} !\n> ${pullRequest.title}`;
          const message = { text };

          await Promise.all(
            requestedReviewers.map(async (potentialReviewer) => {
              if (sender.login === potentialReviewer.login) return;

              const result = await repoContext.slack.postMessage(
                'pr-review',
                potentialReviewer.id,
                potentialReviewer.login,
                message,
              );
              if (result) {
                await appContext.mongoStores.slackSentMessages.insertOne({
                  type: 'review-requested',
                  typeId: `${pullRequest.id}_${
                    requestedTeam ? `${requestedTeam.id}_` : ''
                  }${potentialReviewer.id}`,
                  message,
                  account: repoContext.accountEmbed,
                  sentTo: [result],
                });
              }
            }),
          );
        }
      },
    ),
  );
}
