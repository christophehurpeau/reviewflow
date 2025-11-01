import type { Probot } from "probot";
import type { AppContext } from "../../context/AppContext.ts";
import * as slackUtils from "../../slack/utils.ts";
import { ExcludesFalsy } from "../../utils/Excludes.ts";
import { checkIfIsThisBot } from "../../utils/github/isBotUser.ts";
import { getReviewsState } from "../../utils/github/pullRequest/reviews.ts";
import { autoApproveAndAutoMerge } from "./actions/autoApproveAndAutoMerge.ts";
import { updateAfterReviewChange } from "./actions/updateAfterReviewChange.ts";
import { updateSlackHomeForPr } from "./actions/utils/updateSlackHome.ts";
import { createPullRequestHandler } from "./utils/createPullRequestHandler.ts";
import { fetchPr } from "./utils/fetchPr.ts";

export default function reviewDismissed(
  app: Probot,
  appContext: AppContext,
): void {
  createPullRequestHandler(
    app,
    appContext,
    "pull_request_review.dismissed",
    (payload) => payload.pull_request,
    async (
      pullRequest,
      context,
      repoContext,
      reviewflowPrContext,
    ): Promise<void> => {
      const sender = context.payload.sender;
      const reviewer = context.payload.review.user!;

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
        const [updatedPr, reviewsState] = await Promise.all([
          fetchPr(context, pullRequest.number),
          getReviewsState(context, pullRequest),
        ]);

        await updateAfterReviewChange(
          updatedPr,
          context,
          appContext,
          repoContext,
          reviewflowPrContext,
          reviewsState,
        );
      }

      if (repoContext.slack) {
        updateSlackHomeForPr(repoContext, pullRequest, {
          assignees: true,
          otherLogins: [reviewer.login],
        });

        if (sender.login === reviewer.login) {
          pullRequest.assignees?.filter(ExcludesFalsy).forEach((assignee) => {
            repoContext.slack.postMessage("pr-review", assignee, {
              text: `:recycle: ${repoContext.slack.mention(
                reviewer.login,
              )} dismissed his review on ${slackUtils.createPrLink(
                pullRequest,
                repoContext,
              )}`,
            });
          });
        } else {
          repoContext.slack.postMessage("pr-review", reviewer, {
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
