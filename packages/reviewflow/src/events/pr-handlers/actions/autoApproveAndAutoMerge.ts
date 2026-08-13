import type {
  EventsWithRepository,
  RepoContext,
} from "../../../context/repoContext";
import type { ProbotEvent } from "../../probot-types";
import type { PullRequestFromRestEndpoint } from "../utils/PullRequestData";
import type { ReviewflowPrContext } from "../utils/createPullRequestContext";
import { tryToAutomerge } from "./tryToAutomerge.ts";
import hasLabelInPR from "./utils/labels/hasLabelInPR.ts";

export const autoApproveAndAutoMerge = async <
  Name extends EventsWithRepository,
>(
  pullRequest: PullRequestFromRestEndpoint,
  context: ProbotEvent<Name>,
  repoContext: RepoContext,
  reviewflowPrContext: ReviewflowPrContext,
  ignoreLabel = false,
): Promise<boolean> => {
  // don't approve from forks
  if (pullRequest.head.repo?.full_name !== pullRequest.base.repo.full_name) {
    return false;
  }
  // const autoMergeLabel = repoContext.labels['merge/automerge'];
  const codeApprovedLabel = repoContext.labels["code/approved"];
  if (ignoreLabel || hasLabelInPR(pullRequest.labels, codeApprovedLabel)) {
    await context.octokit.rest.pulls.createReview(
      context.pullRequest({ event: "APPROVE" }),
    );

    await tryToAutomerge({
      pullRequest,
      context,
      repoContext,
      reviewflowPrContext,
    });
    return true;
  }

  return false;
};
