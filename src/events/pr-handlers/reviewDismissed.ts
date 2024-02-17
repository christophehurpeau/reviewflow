import type { Probot } from 'probot';
import type { AppContext } from '../../context/AppContext';
import * as slackUtils from '../../slack/utils';
import { checkIfIsThisBot } from '../../utils/github/isBotUser';
import { getReviewersWithState } from '../../utils/github/pullRequest/reviews';
import { autoApproveAndAutoMerge } from './actions/autoApproveAndAutoMerge';
import { updateAfterReviewChange } from './actions/updateAfterReviewChange';
import { updateSlackHomeForPr } from './actions/utils/updateSlackHome';
import { createPullRequestHandler } from './utils/createPullRequestHandler';
import { fetchPr } from './utils/fetchPr';

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

      // if reviewflow's approval was dismissed (probably by "stale" option when a new commit is pushed)
      if (reviewflowPrContext && checkIfIsThisBot(reviewer)) {
        const pr = await fetchPr(context, pullRequest.number);
        await autoApproveAndAutoMerge(
          pr,
          context,
          repoContext,
          reviewflowPrContext,
          true,
        );
        return;
      }

      if (
        /* repo is not ignored */
        reviewflowPrContext
      ) {
        const [updatedPr, reviewersWithState] = await Promise.all([
          fetchPr(context, pullRequest.number),
          getReviewersWithState(context, pullRequest),
        ]);

        await updateAfterReviewChange(
          updatedPr,
          context,
          appContext,
          repoContext,
          reviewflowPrContext,
          reviewersWithState,
        );
      }

      if (repoContext.slack) {
        updateSlackHomeForPr(repoContext, pullRequest, {
          assignees: true,
          otherLogins: [reviewer.login],
        });

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
