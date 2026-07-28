import { GraphqlResponseError } from "@octokit/graphql";
import type {
  EventsWithRepository,
  RepoContext,
  RescheduleTime,
} from "../../../context/repoContext.ts";
import { checkIfUserIsBot } from "../../../utils/github/isBotUser.ts";
import {
  disableGithubAutoMergeMutation,
  enableGithubAutoMergeMutation,
} from "../../../utils/github/pullRequest/autoMerge.ts";
import type { AutoMergeRequest } from "../../../utils/github/pullRequest/autoMerge.ts";
import type { ProbotEvent } from "../../probot-types.ts";
import type {
  BasicUser,
  PullRequestWithDecentData,
} from "../utils/PullRequestData.ts";
import { createPrMinimumDataFromPr } from "../utils/createPrMinimumDataFromPr.ts";
import type { ReviewflowPrContext } from "../utils/createPullRequestContext.ts";
import { createCommitMessage } from "./createCommitMessage.ts";
import { requestRestrictedApprovalReviewers } from "./requestRestrictedApprovalReviewers.ts";
import { parseBody } from "./utils/body/parseBody.ts";
import { checkIsMissingRestrictedApprobation } from "./utils/restrictedApprobation.ts";

function isPullRequestClosedGraphQLError(err: unknown): boolean {
  if (!err) return false;

  if (err instanceof GraphqlResponseError) {
    if (err.message.includes("Pull request is closed")) return true;
    const errors = Array.isArray(err.errors) ? err.errors : [];
    return errors.some((e) => {
      return e.message?.includes("Pull request is closed");
    });
  }

  return false;
}

export interface MergeOrEnableGithubAutoMergeResult {
  wasMerged: boolean;
  wasAlreadyMerged?: boolean;
  isRescheduled?: boolean;
  didFailedToEnableAutoMerge?: boolean;
  isWaitingForRestrictedApproval?: boolean;
  mergedRequest?: AutoMergeRequest;
}

// github computes mergeability lazily: reading it triggers the computation and returns
// "unknown" until it's done, so a cold read must be retried instead of ending the flow.
const maxUnknownMergeableStateRetries = 5;

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
  fromRescheduleAttempt = 0,
): Promise<MergeOrEnableGithubAutoMergeResult> => {
  if (pullRequest.draft) {
    return {
      wasMerged: false,
      wasAlreadyMerged: false,
    };
  }
  if (pullRequest.merged_at) {
    return {
      wasMerged: false,
      wasAlreadyMerged: true,
    };
  }

  // if the pull request is closed (but not merged) we must not try to enable auto-merge
  if (pullRequest.state === "closed" || pullRequest.closed_at) {
    return {
      wasMerged: false,
      didFailedToEnableAutoMerge: true,
    };
  }

  // don't enable auto merge merge for forks unless there is a login
  if (!user || checkIfUserIsBot(repoContext, user)) {
    if (
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- it seems base or head can be undefined
      pullRequest.head?.repo?.full_name !== pullRequest.base?.repo.full_name
    ) {
      return {
        wasMerged: false,
        didFailedToEnableAutoMerge: true,
      };
    }
  }

  if (
    repoContext.settings.defaultBranchProtectionRules?.requiresStatusChecks ===
      false ||
    repoContext.config.disableAutoMerge
  ) {
    return {
      wasMerged: false,
      didFailedToEnableAutoMerge: true,
    };
  }
  if (
    checkIsMissingRestrictedApprobation({
      restrictAutoMergeTo: repoContext.config.restrictAutoMergeTo,
      authorLogin: pullRequest.user?.login,
      approvedLogins: reviewflowPrContext.reviewflowPr.reviews.approved.map(
        (approval) => approval.login,
      ),
    })
  ) {
    await requestRestrictedApprovalReviewers(pullRequest, context, repoContext);

    return {
      wasMerged: false,
      isWaitingForRestrictedApproval: true,
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
    const mergeableStateLog =
      "mergeable_state" in pullRequest
        ? pullRequest.mergeable_state
        : "[missing]";
    const attempt = fromRescheduleAttempt + 1;

    if (attempt > maxUnknownMergeableStateRetries) {
      context.log.info(
        `mergeOrEnableGithubAutomerge mergeable_state is ${mergeableStateLog} after ${fromRescheduleAttempt} attempts, give up on rescheduling`,
      );
      return {
        wasMerged: false,
        isRescheduled: false,
      };
    }

    const rescheduleTime = fromRescheduleTime ? "long+timeout" : "short";
    context.log.info(
      `mergeOrEnableGithubAutomerge mergeable_state is ${mergeableStateLog}, rescheduling with ${rescheduleTime} (attempt ${attempt})`,
    );
    await repoContext.reschedule(
      context,
      createPrMinimumDataFromPr(pullRequest),
      rescheduleTime,
      user,
      attempt,
    );
    return {
      wasMerged: false,
      isRescheduled: true,
    };
  }

  const isBlocked = pullRequest.mergeable_state === "blocked";
  const isMergeableNow =
    pullRequest.mergeable_state === "clean" ||
    pullRequest.mergeable_state === "has_hooks" ||
    pullRequest.mergeable_state === "unstable";

  let triedToMerge = false;

  if (isMergeableNow) {
    // github refuses to enable auto merge when the pull request can already be merged,
    // so when reviewflow steps are not all passed there is nothing to do but wait
    if (skipCheckMergeableState) {
      await repoContext.reschedule(
        context,
        createPrMinimumDataFromPr(pullRequest),
        fromRescheduleTime === "long+timeout" ? "long+timeout" : "short",
        user,
      );
      return {
        wasMerged: false,
        isRescheduled: true,
      };
    }

    try {
      await context.octokit.rest.pulls.merge({
        merge_method: "squash",
        owner: pullRequest.base.repo.owner!.login,
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
    if (isPullRequestClosedGraphQLError(error)) {
      return {
        wasMerged: false,
        didFailedToEnableAutoMerge: true,
      };
    }

    context.log.error(
      {
        ...context.repo({
          issue_number: pullRequest.number,
        }),
        error,
      },
      `Could not enable automerge: ${(error as any)?.message}`,
    );

    if (isBlocked) {
      await repoContext.reschedule(
        context,
        createPrMinimumDataFromPr(pullRequest),
        "long+timeout",
        user,
      );
      return {
        wasMerged: false,
        isRescheduled: true,
      };
    }

    if (fromRescheduleTime) {
      if (triedToMerge) {
        context.octokit.rest.issues.createComment(
          context.repo({
            issue_number: pullRequest.number,
            body: `${
              user?.login ? `@${user.login} ` : ""
            }Could not automerge nor enable automerge`,
          }),
        );
      } else {
        context.octokit.rest.issues.createComment(
          context.repo({
            issue_number: pullRequest.number,
            body: `${
              user?.login ? `@${user.login} ` : ""
            }Could not enable automerge`,
          }),
        );
      }
    } else {
      await repoContext.reschedule(
        context,
        createPrMinimumDataFromPr(pullRequest),
        "short",
        user,
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
      {
        ...context.repo({
          issue_number: pullRequest.number,
        }),
        error,
      },
      "Could not disable automerge",
    );
    context.octokit.rest.issues.createComment(
      context.repo({
        issue_number: pullRequest.number,
        body: `${login ? `@${login} ` : ""}Could not disable automerge`,
      }),
    );
    return false;
  }
};
