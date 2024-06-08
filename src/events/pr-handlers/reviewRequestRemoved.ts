import type { Probot } from "probot";
import type { AppContext } from "../../context/AppContext";
import * as slackUtils from "../../slack/utils";
import { getReviewersWithState } from "../../utils/github/pullRequest/reviews";
import { updateAfterReviewChange } from "./actions/updateAfterReviewChange";
import { updateSlackHomeForPr } from "./actions/utils/updateSlackHome";
import { createPullRequestHandler } from "./utils/createPullRequestHandler";
import { fetchPr } from "./utils/fetchPr";

export default function reviewRequestRemoved(
  app: Probot,
  appContext: AppContext,
): void {
  createPullRequestHandler(
    app,
    appContext,
    "pull_request.review_request_removed",
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
      const isMerged = false;

      if (reviewflowPrContext && !repoContext.shouldIgnore) {
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

      // don't send notification when PR is still in draft. Notifications will be send when the PR is ready to review.
      if (pullRequest.draft) return;

      if (repoContext.slack) {
        updateSlackHomeForPr(repoContext, pullRequest, {
          user: true,
          assignees: true,
          requestedReviewers: true,
        });

        if (requestedReviewers.some((rr) => rr.login === sender.login)) {
          requestedReviewers.forEach((potentialReviewer) => {
            if (potentialReviewer.login === sender.login) return;
            repoContext.slack.postMessage(
              "pr-review",
              potentialReviewer,
              {
                text: `:skull_and_crossbones: ${repoContext.slack.mention(
                  sender.login,
                )} removed the request for your team _${
                  requestedTeam.name
                }_ review on ${slackUtils.createPrLink(
                  pullRequest,
                  repoContext,
                )}${isMerged ? " and PR is merged :tada:" : ""}`,
              },
              requestedTeam ? requestedTeam.id : undefined,
            );
          });
        } else {
          requestedReviewers.forEach((potentialReviewer) => {
            repoContext.slack.postMessage(
              "pr-review",
              potentialReviewer,
              {
                text: `:skull_and_crossbones: ${repoContext.slack.mention(
                  sender.login,
                )} removed the request for  ${
                  requestedTeam ? `your team _${requestedTeam.name}_` : "your"
                } review on ${slackUtils.createPrLink(
                  pullRequest,
                  repoContext,
                )}${isMerged ? " and PR is merged :tada:" : ""}`,
              },
              requestedTeam ? requestedTeam.id : undefined,
            );
          });
        }

        await Promise.all(
          requestedReviewers.map(async (potentialReviewer) => {
            const sentMessageRequestedReview =
              await appContext.mongoStores.slackSentMessages.findOne({
                "account.id": repoContext.accountEmbed.id,
                "account.type": repoContext.accountEmbed.type,
                type: "review-requested",
                typeId: `${pullRequest.id}_${
                  requestedTeam ? `${requestedTeam.id}_` : ""
                }${potentialReviewer.id}`,
              } as const);

            if (sentMessageRequestedReview) {
              const sentTo = sentMessageRequestedReview.sentTo[0];
              const message = sentMessageRequestedReview.message;
              await Promise.all([
                repoContext.slack.updateMessage(
                  sentTo.user,
                  sentTo.ts,
                  sentTo.channel,
                  {
                    ...message,
                    text: message.text
                      .split("\n")
                      .map((l) => `~${l}~`)
                      .join("\n"),
                  },
                ),
                repoContext.slack.addReaction(
                  sentTo.user,
                  sentTo.ts,
                  sentTo.channel,
                  "skull_and_crossbones",
                ),
                appContext.mongoStores.slackSentMessages.deleteOne(
                  sentMessageRequestedReview,
                ),
              ]);
            }
          }),
        );
      }
    },
  );
}
