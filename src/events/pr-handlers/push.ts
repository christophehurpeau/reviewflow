import type { RestEndpointMethodTypes } from "@octokit/rest";
import type { Probot } from "probot";
import type { AppContext } from "../../context/AppContext.ts";
import { checkIfUserIsBot } from "../../utils/github/isBotUser.ts";
import { createPullRequestsHandler } from "./utils/createPullRequestHandler.ts";

export default function status(app: Probot, appContext: AppContext): void {
  createPullRequestsHandler(
    app,
    appContext,
    "push",
    async (
      payload,
      repoContext,
      context,
    ): Promise<
      RestEndpointMethodTypes["repos"]["listPullRequestsAssociatedWithCommit"]["response"]["data"]
    > => {
      if (repoContext.shouldIgnore) return [];

      // filter config warnOnForcePushAfterReviewStarted enabled only
      if (!repoContext.config.warnOnForcePushAfterReviewStarted) return [];

      // filter only whitelisted repositories
      if (
        repoContext.config.warnOnForcePushAfterReviewStarted.repositoryNames &&
        !repoContext.config.warnOnForcePushAfterReviewStarted.repositoryNames.includes(
          payload.repository.name,
        )
      ) {
        return [];
      }

      // filter only force-push
      if (!payload.forced || !payload.pusher.name) return [];

      if (!payload.ref.startsWith("refs/heads/")) return [];

      const prs = await context.octokit.rest.pulls.list(
        context.repo({
          state: "open",
          head: `${payload.repository.owner!.login}:${payload.ref.slice(
            "refs/heads/".length,
          )}`,
        }),
      );

      return prs.data;
    },
    async (pullRequest, context, repoContext): Promise<void> => {
      const login =
        context.payload.pusher.username || context.payload.pusher.name;

      const isPushedByBot = checkIfUserIsBot(
        repoContext,
        context.payload.sender!,
      );

      const isClosedPr = !!pullRequest.closed_at;
      let hasReviewStarted: boolean =
        !pullRequest.draft &&
        !!(
          pullRequest.requested_reviewers?.length ||
          pullRequest.requested_teams?.length
        );

      if (!isPushedByBot && !isClosedPr && !hasReviewStarted) {
        const reviewsResponse = await context.octokit.rest.pulls.listReviews(
          context.repo({
            pull_number: pullRequest.number,
            per_page: 1,
          }),
        );
        const hadReviews = reviewsResponse.data.length > 0;
        if (hadReviews) {
          hasReviewStarted = true;
        }
      }

      if (
        !isPushedByBot &&
        !isClosedPr &&
        hasReviewStarted &&
        repoContext.config.warnOnForcePushAfterReviewStarted
      ) {
        await context.octokit.rest.issues.createComment(
          context.repo({
            issue_number: pullRequest.number,
            body: `${login ? `@${login} ` : ""}: ${
              repoContext.config.warnOnForcePushAfterReviewStarted.message
            }`,
          }),
        );
      }
    },
  );
}
