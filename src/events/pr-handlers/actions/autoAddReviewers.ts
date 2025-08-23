import type { EmitterWebhookEventName } from "@octokit/webhooks";
import type { RepoContext } from "../../../context/repoContext";
import type { ProbotEvent } from "../../probot-types";
import type { PullRequestWithDecentData } from "../utils/PullRequestData";

export const autoAddReviewers = async <Name extends EmitterWebhookEventName>(
  pullRequest: PullRequestWithDecentData,
  context: ProbotEvent<Name>,
  repoContext: RepoContext,
): Promise<void> => {
  if (!repoContext.config.autoReviewers) return;
  if (
    !pullRequest.requested_reviewers ||
    pullRequest.requested_reviewers.length > 0
  ) {
    return;
  }

  const autoReviewers = repoContext.config.autoReviewers.filter(
    (reviewer) => pullRequest.user.login !== reviewer,
  );

  if (autoReviewers.length === 0) return;

  await context.octokit.pulls.requestReviewers(
    context.pullRequest({
      pull_number: pullRequest.number,
      reviewers: autoReviewers,
    }),
  );
};
