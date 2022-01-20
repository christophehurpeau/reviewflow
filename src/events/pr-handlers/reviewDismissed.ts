import type { Probot } from 'probot';
import type { AppContext } from '../../context/AppContext';
import * as slackUtils from '../../slack/utils';
import { updateReviewStatus } from './actions/updateReviewStatus';
import { createPullRequestHandler } from './utils/createPullRequestHandler';
import { fetchPr } from './utils/fetchPr';
import { getReviewersAndReviewStates } from './utils/getReviewersAndReviewStates';

export default function reviewDismissed(
  app: Probot,
  appContext: AppContext,
): void {
  createPullRequestHandler(
    app,
    appContext,
    'pull_request_review.dismissed',
    (payload) => payload.pull_request,
    async (
      pullRequest,
      context,
      repoContext,
      reviewflowPrContext,
    ): Promise<void> => {
      const sender = context.payload.sender;
      const reviewer = context.payload.review.user;
      const reviewerGroup = repoContext.getReviewerGroup(reviewer.login);

      if (
        /* repo is not ignored */
        reviewflowPrContext &&
        reviewerGroup &&
        repoContext.config.labels.review[reviewerGroup]
      ) {
        const updatedPr = await fetchPr(context, pullRequest.number);

        const { reviewStates } = await getReviewersAndReviewStates(
          context,
          repoContext,
        );

        const hasChangesRequestedInReviews =
          reviewStates[reviewerGroup].changesRequested !== 0;
        const hasApprovals = reviewStates[reviewerGroup].approved !== 0;
        const hasRequestedReviewsForGroup = repoContext.approveShouldWait(
          reviewerGroup,
          updatedPr,
          { includesReviewerGroup: true },
        );

        await updateReviewStatus(
          updatedPr,
          context,
          appContext,
          repoContext,
          reviewflowPrContext,
          reviewerGroup,
          {
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
          },
        );

        if (updatedPr.assignees) {
          updatedPr.assignees.forEach((assignee) => {
            if (assignee) {
              repoContext.slack.updateHome(assignee.login);
            }
          });
        }
        if (
          !updatedPr.assignees ||
          !updatedPr.assignees.some(
            (assignee) => assignee && assignee.login === reviewer.login,
          )
        ) {
          repoContext.slack.updateHome(reviewer.login);
        }
      }

      if (repoContext.slack) {
        if (sender.login === reviewer.login) {
          pullRequest.assignees.forEach((assignee) => {
            repoContext.slack.postMessage('pr-review', assignee, {
              text: `:recycle: ${repoContext.slack.mention(
                reviewer.login,
              )} dismissed his review on ${slackUtils.createPrLink(
                pullRequest,
                repoContext,
              )}`,
            });
          });
        } else {
          repoContext.slack.postMessage('pr-review', reviewer, {
            text: `:recycle: ${repoContext.slack.mention(
              sender.login,
            )} dismissed your review on ${slackUtils.createPrLink(
              pullRequest,
              repoContext,
            )}`,
          });
        }
      }
    },
  );
}
