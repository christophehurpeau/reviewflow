import type { Probot } from 'probot';
import type { AppContext } from '../../context/AppContext';
import * as slackUtils from '../../slack/utils';
import { updateCommentBodyProgressFromStepsState } from './actions/updateCommentBodyProgressFromStepsState';
import { updateReviewStatus } from './actions/updateReviewStatus';
import { updateStatusCheckFromStepsState } from './actions/updateStatusCheckFromStepsState';
import { calcStepsState } from './actions/utils/steps/calcStepsState';
import { createPullRequestHandler } from './utils/createPullRequestHandler';

export default function reviewRequested(
  app: Probot,
  appContext: AppContext,
): void {
  createPullRequestHandler(
    app,
    appContext,
    'pull_request.review_requested',
    (payload) => payload.pull_request,
    async (
      pullRequest,
      context,
      repoContext,
      reviewflowPrContext,
    ): Promise<void> => {
      // don't send notification when PR is still in draft. Notifications will be send when the PR is ready to review.
      if (pullRequest.draft) return;

      const sender = context.payload.sender;

      const requestedReviewer = (context.payload as any).requested_reviewer;
      const requestedTeam = (context.payload as any).requested_team;
      const requestedReviewers = requestedReviewer
        ? [requestedReviewer]
        : await repoContext.getMembersForTeams([requestedTeam.id]);

      const reviewerGroup = requestedReviewer
        ? repoContext.getReviewerGroup(requestedReviewer.login)
        : repoContext.getTeamGroup(requestedTeam.name);

      const shouldWait = false;
      // repoContext.approveShouldWait(reviewerGroup, pr.requested_reviewers, { includesWaitForGroups: true });

      if (
        /* repo is not ignored */
        reviewflowPrContext &&
        reviewerGroup &&
        repoContext.config.labels.review[reviewerGroup]
      ) {
        const newLabels = await updateReviewStatus(
          pullRequest,
          context,
          repoContext,
          [
            {
              reviewGroup: reviewerGroup,
              add: ['needsReview', !shouldWait && 'requested'],
              remove: ['approved'],
            },
          ],
        );
        if (newLabels !== pullRequest.labels) {
          const stepsState = calcStepsState({
            repoContext,
            pullRequest,
            labels: newLabels,
          });

          await Promise.all([
            updateStatusCheckFromStepsState(
              stepsState,
              pullRequest,
              context,
              appContext,
              reviewflowPrContext,
            ),
            updateCommentBodyProgressFromStepsState(
              stepsState,
              context,
              reviewflowPrContext,
            ),
          ]);
        }

        /* update slack home */
        const assigneesLogins: string[] = [];
        if (pullRequest.assignees) {
          pullRequest.assignees.forEach((assignee) => {
            assigneesLogins.push(assignee.login);
            repoContext.slack.updateHome(assignee.login);
          });
        }

        requestedReviewers.forEach((potentialReviewer) => {
          if (assigneesLogins.includes(potentialReviewer.login)) return;
          repoContext.slack.updateHome(potentialReviewer.login);
        });
      }

      /* send slack notification */
      if (!shouldWait && repoContext.slack) {
        const text = `:eyes: ${repoContext.slack.mention(
          sender.login,
        )} requests ${
          requestedReviewer ? 'your' : `your team _${requestedTeam.name}_`
        } review on ${slackUtils.createPrLink(pullRequest, repoContext)} !\n> ${
          pullRequest.title
        }`;
        const message = { text };

        await Promise.all(
          requestedReviewers.map(async (potentialReviewer) => {
            if (sender.login === potentialReviewer.login) return;

            const result = await repoContext.slack.postMessage(
              'pr-review',
              potentialReviewer,
              message,
              requestedTeam ? requestedTeam.id : undefined,
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
  );
}
