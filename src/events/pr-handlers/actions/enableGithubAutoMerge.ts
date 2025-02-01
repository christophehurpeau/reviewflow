import type {
  EventsWithRepository,
  RepoContext,
  RescheduleTime,
} from "../../../context/repoContext";
import { checkIfUserIsBot } from "../../../utils/github/isBotUser";
import type { AutoMergeRequest } from "../../../utils/github/pullRequest/autoMerge";
import {
  enableGithubAutoMergeMutation,
  disableGithubAutoMergeMutation,
} from "../../../utils/github/pullRequest/autoMerge";
import type { ProbotEvent } from "../../probot-types";
import type {
  BasicUser,
  PullRequestWithDecentData,
} from "../utils/PullRequestData";
import type { ReviewflowPrContext } from "../utils/createPullRequestContext";
import { createMergeLockPrFromPr } from "../utils/mergeLock";
import { createCommitMessage } from "./autoMergeIfPossible";
import { parseBody } from "./utils/body/parseBody";

export interface MergeOrEnableGithubAutoMergeResult {
  wasMerged: boolean;
  wasAlreadyMerged?: boolean;
  isRescheduled?: boolean;
  didFailedToEnableAutoMerge?: boolean;
  mergedRequest?: AutoMergeRequest;
}

export const mergeOrEnableGithubAutoMerge = async <
  EventName extends EventsWithRepository,
>(
  pullRequest: PullRequestWithDecentData,
  context: ProbotEvent<EventName>,
  repoContext: RepoContext,
  reviewflowPrContext: ReviewflowPrContext,
  user?: BasicUser,
  skipCheckMergeableState?: boolean,
  fromRescheduleTime?: RescheduleTime,
): Promise<MergeOrEnableGithubAutoMergeResult> => {
  if (pullRequest.merged_at || pullRequest.draft) {
    return {
      wasMerged: false,
      wasAlreadyMerged: true,
    };
  }

  // don't enable auto merge merge for forks unless there is a login
  if (!user || checkIfUserIsBot(repoContext, user)) {
    if (pullRequest.head.repo?.full_name !== pullRequest.base.repo.full_name) {
      return {
        wasMerged: false,
        didFailedToEnableAutoMerge: true,
      };
    }
  }

  if (
    repoContext.settings.defaultBranchProtectionRules?.requiresStatusChecks ===
    false
  ) {
    return {
      wasMerged: false,
      didFailedToEnableAutoMerge: true,
    };
  }

  const parsedBody = parseBody(
    reviewflowPrContext.commentBody,
    repoContext.config.prDefaultOptions,
  );
  const options = parsedBody.options || repoContext.config.prDefaultOptions;

  const [commitHeadline, commitBody] = createCommitMessage({
    pullRequest,
    parsedBody,
    options,
  });

  if (pullRequest.auto_merge) {
    if (
      pullRequest.auto_merge.commit_title !== commitHeadline ||
      pullRequest.auto_merge.commit_message !== commitBody
    ) {
      await disableGithubAutoMergeMutation(context, {
        pullRequestId: pullRequest.node_id,
      });
      await enableGithubAutoMergeMutation(context, {
        pullRequestId: pullRequest.node_id,
        mergeMethod: "SQUASH",
        commitHeadline,
        commitBody,
      });
    }
    return {
      wasMerged: false,
      mergedRequest: { enabledBy: pullRequest.auto_merge.enabled_by },
    };
  }

  if (
    !("mergeable_state" in pullRequest) ||
    pullRequest.mergeable_state === "unknown"
  ) {
    if (!fromRescheduleTime || fromRescheduleTime === "short") {
      const rescheduleTime =
        fromRescheduleTime === "short" ? "long+timeout" : "short";
      context.log.info(
        `mergeOrEnableGithubAutomerge mergeable_state is ${
          "mergeable_state" in pullRequest
            ? pullRequest.mergeable_state
            : "[missing]"
        }, rescheduling with ${rescheduleTime}`,
      );
      // GitHub is determining whether the pull request is mergeable
      await repoContext.reschedule(
        context,
        createMergeLockPrFromPr(pullRequest),
        rescheduleTime,
        user,
      );
      return {
        wasMerged: false,
        isRescheduled: true,
      };
    } else {
      context.log.info(
        `mergeOrEnableGithubAutomerge mergeable_state is ${
          "mergeable_state" in pullRequest
            ? pullRequest.mergeable_state
            : "[missing]"
        }, give up on rescheduling`,
      );
      return {
        wasMerged: false,
        isRescheduled: false,
      };
    }
  }

  let triedToMerge = false;

  if (
    !skipCheckMergeableState &&
    (pullRequest.mergeable_state === "clean" ||
      pullRequest.mergeable_state === "has_hooks" ||
      pullRequest.mergeable_state === "unstable")
  ) {
    try {
      await context.octokit.pulls.merge({
        merge_method: "squash",
        owner: pullRequest.base.repo.owner.login,
        repo: pullRequest.base.repo.name,
        pull_number: pullRequest.number,
        commit_title: commitHeadline,
        commit_message: commitBody,
      });
      return {
        wasMerged: true,
      };
    } catch (error) {
      triedToMerge = true;
      context.log.error(
        {
          ...context.repo({
            issue_number: pullRequest.number,
          }),
          err: error,
        },
        "Could not automerge",
      );
    }
  }

  try {
    /* Conditions:
Allow auto-merge enabled in settings.
The pull request base must have a branch protection rule with at least one requirement enabled.
The pull request must be in a state where requirements have not yet been satisfied. If the pull request can already be merged, attempting to enable auto-merge will fail.
*/
    const response = await enableGithubAutoMergeMutation(context, {
      pullRequestId: pullRequest.node_id,
      mergeMethod: "SQUASH",
      commitHeadline,
      commitBody,
    });
    return {
      wasMerged: false,
      mergedRequest:
        response.enablePullRequestAutoMerge.pullRequest.autoMergeRequest,
    };
  } catch (error) {
    context.log.error(
      "Could not enable automerge",
      context.repo({
        issue_number: pullRequest.number,
      }),
      error,
    );
    if (triedToMerge) {
      context.octokit.issues.createComment(
        context.repo({
          issue_number: pullRequest.number,
          body: `${
            user?.login ? `@${user.login} ` : ""
          }Could not automerge nor enable automerge`,
        }),
      );
    } else {
      context.octokit.issues.createComment(
        context.repo({
          issue_number: pullRequest.number,
          body: `${
            user?.login ? `@${user.login} ` : ""
          }Could not enable automerge`,
        }),
      );
    }
  }
  return {
    wasMerged: false,
    didFailedToEnableAutoMerge: triedToMerge,
  };
};

export const disableGithubAutoMerge = async <
  EventName extends EventsWithRepository,
>(
  pullRequest: PullRequestWithDecentData,
  context: ProbotEvent<EventName>,
  repoContext: RepoContext,
  reviewflowPrContext: ReviewflowPrContext,
  login?: string,
): Promise<boolean> => {
  try {
    /* Conditions:
Allow auto-merge enabled in settings.
The pull request base must have a branch protection rule with at least one requirement enabled.
The pull request must be in a state where requirements have not yet been satisfied. If the pull request can already be merged, attempting to enable auto-merge will fail.
*/
    const response = await disableGithubAutoMergeMutation(context, {
      pullRequestId: pullRequest.node_id,
    });
    return (
      response.disablePullRequestAutoMerge.pullRequest.autoMergeRequest === null
    );
  } catch (error) {
    context.log.error(
      "Could not disable automerge",
      context.repo({
        issue_number: pullRequest.number,
      }),
      error,
    );
    context.octokit.issues.createComment(
      context.repo({
        issue_number: pullRequest.number,
        body: `${login ? `@${login} ` : ""}Could not disable automerge`,
      }),
    );
    return false;
  }
};
