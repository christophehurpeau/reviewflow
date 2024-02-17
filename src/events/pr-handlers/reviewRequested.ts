import type { Probot } from 'probot';
import type { AppContext } from '../../context/AppContext';
import * as slackUtils from '../../slack/utils';
import { getReviewersWithState } from '../../utils/github/pullRequest/reviews';
import { updateAfterReviewChange } from './actions/updateAfterReviewChange';
import { updateSlackHomeForPr } from './actions/utils/updateSlackHome';
import { createPullRequestHandler } from './utils/createPullRequestHandler';
import type { PullRequestFromRestEndpoint } from './utils/fetchPr';
import { fetchPr } from './utils/fetchPr';

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
      const sender = context.payload.sender;

      const requestedReviewer = (context.payload as any).requested_reviewer;
      const requestedTeam = (context.payload as any).requested_team;
      const requestedReviewers = requestedReviewer
        ? [requestedReviewer]
        : await repoContext.getMembersForTeams([requestedTeam.id]);

      let updatedPullRequest: PullRequestFromRestEndpoint | undefined;

      if (
        /* repo is not ignored */
        reviewflowPrContext
      ) {
        const [updatedPr, reviewersWithState] = await Promise.all([
          fetchPr(context, pullRequest.number),
          getReviewersWithState(context, pullRequest),
        ]);
        updatedPullRequest = updatedPr;

        await updateAfterReviewChange(
          updatedPr,
          context,
          appContext,
          repoContext,
          reviewflowPrContext,
          reviewersWithState,
        );
      }

      // don't send notification when PR is still in draft. Notifications will be send when the PR is ready to review.
      if (pullRequest.draft) return;

      /* send slack notification */
      if (repoContext.slack) {
        updateSlackHomeForPr(repoContext, pullRequest, {
          user: true,
          assignees: true,
          requestedReviewers: true,
        });

        const requestedByNameInTeam = requestedTeam
          ? pullRequest.requested_reviewers
              .map((reviewer) => (reviewer as any).login)
              .filter(
                (login) =>
                  login &&
                  login !== sender.login &&
                  requestedReviewers.some((rr) => rr.login === login),
              )
          : [];

        const text = `:eyes: ${repoContext.slack.mention(
          sender.login,
        )} requests ${
          requestedReviewer ? 'your' : `your team _${requestedTeam.name}_`
        } review on ${slackUtils.createPrLink(pullRequest, repoContext)}${
          requestedByNameInTeam.length > 0
            ? ` (team members requested by name: ${requestedByNameInTeam.join(
                ', ',
              )})`
            : ''
        }${
          updatedPullRequest
            ? ` · ${slackUtils.createPrChangesInformationFromPullRequestRest(
                updatedPullRequest,
              )}`
            : ''
        }\n> ${pullRequest.title}`;

        const message = { text };

        await Promise.all(
          requestedReviewers.map(async (potentialReviewer) => {
            if (sender.login === potentialReviewer.login) return;

            if (requestedTeam) {
              if (requestedByNameInTeam.includes(potentialReviewer.login)) {
                // skip notification for team if user is already requested by name
                return;
              }
            }

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
