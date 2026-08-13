import type {
  EventsWithRepository,
  RepoContext,
} from "../../../context/repoContext";
import { ExcludesFalsy } from "../../../utils/Excludes.ts";
import { getReviewsState } from "../../../utils/github/pullRequest/reviews.ts";
import type { ProbotEvent } from "../../probot-types";
import type { PullRequestWithDecentData } from "../utils/PullRequestData";
import { getRestrictedReviewersToRequest } from "./utils/restrictedApprobation.ts";

// asking github for the review makes the wait visible in the review step and in the pull
// request itself, instead of automerge silently waiting for an approbation nobody asked for
export const requestRestrictedApprovalReviewers = async <
  Name extends EventsWithRepository,
>(
  pullRequest: PullRequestWithDecentData,
  context: ProbotEvent<Name>,
  repoContext: RepoContext,
): Promise<void> => {
  const reviewers = getRestrictedReviewersToRequest({
    restrictAutoMergeTo: repoContext.config.restrictAutoMergeTo,
    authorLogin: pullRequest.user?.login,
    requestedReviewerLogins: (pullRequest.requested_reviewers ?? [])
      .filter(ExcludesFalsy)
      .map((reviewer) => ("login" in reviewer ? reviewer.login : undefined))
      .filter(ExcludesFalsy),
  });

  if (reviewers.length === 0) return;

  // requesting a review from someone who already approved dismisses that approbation, so
  // reviewflowPr reviews being outdated must not lead to asking again
  const { reviewersWithState } = await getReviewsState(context, pullRequest);
  const reviewersToRequest = reviewers.filter(
    (login) =>
      !reviewersWithState.some(
        (reviewer) => reviewer.login === login && reviewer.state === "APPROVED",
      ),
  );

  if (reviewersToRequest.length === 0) return;

  try {
    await context.octokit.rest.pulls.requestReviewers(
      context.repo({
        pull_number: pullRequest.number,
        reviewers: reviewersToRequest,
      }),
    );
  } catch (error) {
    // a login can be a bot or not have access to the repository
    context.log.error(
      {
        ...context.repo({ issue_number: pullRequest.number }),
        err: error,
      },
      `Could not request review from: ${reviewersToRequest.join(", ")}`,
    );
  }
};
