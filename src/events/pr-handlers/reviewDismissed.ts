import { Application } from 'probot';
import { AppContext } from '../../context/AppContext';
import * as slackUtils from '../../slack/utils';
import { createPullRequestHandler } from './utils/createPullRequestHandler';
import { updateReviewStatus } from './actions/updateReviewStatus';
import { getReviewersAndReviewStates } from './utils/getReviewersAndReviewStates';
import { fetchPullRequestAndCreateContext } from './utils/createPullRequestContext';

export default function reviewDismissed(
  app: Application,
  appContext: AppContext,
): void {
  app.on(
    'pull_request_review.dismissed',
    createPullRequestHandler(
      appContext,
      (payload) => payload.pull_request,
      async (prContext, context, repoContext): Promise<void> => {
        const sender = context.payload.sender;
        const reviewer = (context.payload as any).review.user;
        const reviewerGroup = repoContext.getReviewerGroup(reviewer.login);

        if (
          !repoContext.shouldIgnore &&
          reviewerGroup &&
          repoContext.config.labels.review[reviewerGroup]
        ) {
          const updatedPrContext = await fetchPullRequestAndCreateContext(
            context,
            prContext,
          );
          const pr = updatedPrContext.updatedPr;

          const { reviewStates } = await getReviewersAndReviewStates(
            context,
            repoContext,
          );
          const hasChangesRequestedInReviews =
            reviewStates[reviewerGroup].changesRequested !== 0;
          const hasApprovals = reviewStates[reviewerGroup].approved !== 0;
          const hasRequestedReviewsForGroup = repoContext.approveShouldWait(
            reviewerGroup,
            pr.requested_reviewers,
            { includesReviewerGroup: true },
          );

          await updateReviewStatus(updatedPrContext, context, reviewerGroup, {
            add: [
              !hasApprovals && 'needsReview',
              hasApprovals &&
                !hasRequestedReviewsForGroup &&
                !hasChangesRequestedInReviews &&
                'approved',
            ],
            remove: [
              !hasRequestedReviewsForGroup &&
                !hasChangesRequestedInReviews &&
                'requested',
              !hasChangesRequestedInReviews && 'changesRequested',
              !hasApprovals && 'approved',
            ],
          });

          if (pr.assignees) {
            pr.assignees.forEach((assignee) => {
              repoContext.slack.updateHome(assignee.login);
            });
          }
          if (
            !pr.assignees.find((assignee) => assignee.login === reviewer.login)
          ) {
            repoContext.slack.updateHome(reviewer.login);
          }
        }

        if (repoContext.slack) {
          if (sender.login === reviewer.login) {
            prContext.pr.assignees.forEach((assignee) => {
              repoContext.slack.postMessage(
                'pr-review',
                assignee.id,
                assignee.login,
                {
                  text: `:skull: ${repoContext.slack.mention(
                    reviewer.login,
                  )} dismissed his review on ${slackUtils.createPrLink(
                    prContext.pr,
                    repoContext,
                  )}`,
                },
              );
            });
          } else {
            repoContext.slack.postMessage(
              'pr-review',
              reviewer.id,
              reviewer.login,
              {
                text: `:skull: ${repoContext.slack.mention(
                  sender.login,
                )} dismissed your review on ${slackUtils.createPrLink(
                  prContext.pr,
                  repoContext,
                )}`,
              },
            );
          }
        }
      },
    ),
  );
}
