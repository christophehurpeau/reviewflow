import type { StatusInfo } from "../../../accountConfigs/types";
import type { AppContext } from "../../../context/AppContext.ts";
import type {
  EventsWithRepository,
  RepoContext,
} from "../../../context/repoContext.ts";
import { ExcludesFalsy } from "../../../utils/Excludes.ts";
import type { ProbotEvent } from "../../probot-types.ts";
import type {
  PullRequestLabels,
  PullRequestWithDecentData,
} from "../utils/PullRequestData.ts";
import type { ReviewflowPrContext } from "../utils/createPullRequestContext.ts";
import { getFailedOrWaitingChecksAndStatuses } from "../utils/getFailedOrWaitingChecksAndStatuses.ts";
import createStatus, { isSameStatus } from "./utils/createStatus.ts";
import hasLabelInPR from "./utils/labels/hasLabelInPR.ts";
import type { StepsState } from "./utils/steps/calcStepsState.ts";

type ReviewflowStatusCheckState = "failure" | "pending" | "success";

const addStatusCheck = async <EventName extends EventsWithRepository>(
  pullRequest: PullRequestWithDecentData,
  context: ProbotEvent<EventName>,
  appContext: AppContext,
  reviewflowPrContext: ReviewflowPrContext,
  {
    state,
    description,
  }: { state: ReviewflowStatusCheckState; description: string },
  previousSha?: string,
): Promise<void> => {
  const previousStatus = reviewflowPrContext.reviewflowPr.flowStatus;

  let prCheck;
  if (!previousStatus) {
    const {
      data: { check_runs: checkRuns },
    } = await context.octokit.checks.listForRef(
      context.repo({
        ref: pullRequest.head.sha,
        per_page: 100,
      }),
    );
    prCheck = checkRuns.find(
      (check): boolean => check.name === process.env.REVIEWFLOW_NAME,
    );
  }

  context.log.debug({ prCheck, state, description }, "add status check");

  const newStatus: StatusInfo = {
    type: state,
    title: description,
    summary: "",
  };

  if (prCheck) {
    const conclusion = state === "pending" ? "failure" : state;
    if (
      prCheck.conclusion !== conclusion ||
      prCheck.output.title !== description
    ) {
      await context.octokit.checks.create(
        context.repo({
          name: process.env.REVIEWFLOW_NAME!,
          head_sha: pullRequest.head.sha,
          started_at: pullRequest.created_at,
          status: "completed",
          conclusion,
          completed_at: new Date().toISOString(),
          output: {
            title: description,
            summary: "",
          },
        }),
      );
    }
  } else {
    const shouldUpdateStatus =
      !!previousSha ||
      reviewflowPrContext.reviewflowPr.lastFlowStatusCommit !==
        pullRequest.head.sha ||
      !previousStatus ||
      !isSameStatus(previousStatus, newStatus);

    await Promise.all([
      previousSha &&
        (previousStatus
          ? previousStatus.type !== "success"
          : state === "failure") &&
        createStatus(context, "", previousSha, {
          type: "success",
          title: "New commits have been pushed",
          summary: "",
        }),

      shouldUpdateStatus &&
        createStatus(context, "", pullRequest.head.sha, newStatus),
    ]);

    if (shouldUpdateStatus) {
      await appContext.mongoStores.prs.partialUpdateOne(
        reviewflowPrContext.reviewflowPr,
        {
          $set: {
            lastFlowStatusCommit: pullRequest.head.sha,
            flowStatus: newStatus,
          },
        },
      );
    }
  }
};

export const updateStatusCheckFromStepsState = <
  EventName extends EventsWithRepository,
  TeamNames extends string,
>(
  stepsState: StepsState,
  pullRequest: PullRequestWithDecentData,
  context: ProbotEvent<EventName>,
  repoContext: RepoContext<TeamNames>,
  appContext: AppContext,
  reviewflowPrContext: ReviewflowPrContext,
  prLabels: PullRequestLabels = pullRequest.labels,
  previousSha?: string,
): Promise<ReviewflowStatusCheckState> => {
  const createFailedStatusCheck = (
    description: string,
  ): Promise<ReviewflowStatusCheckState> =>
    addStatusCheck(
      pullRequest,
      context,
      appContext,
      reviewflowPrContext,
      {
        state: "failure",
        description,
      },
      previousSha,
    ).then(() => "failure");

  const createPendingStatusCheck = (
    description: string,
  ): Promise<ReviewflowStatusCheckState> =>
    addStatusCheck(
      pullRequest,
      context,
      appContext,
      reviewflowPrContext,
      {
        state: "pending",
        description,
      },
      previousSha,
    ).then(() => "pending");

  // PR Merged
  if (pullRequest.merged_at) {
    return addStatusCheck(
      pullRequest,
      context,
      appContext,
      reviewflowPrContext,
      {
        state: "success",
        description: "✓ PR merged",
      },
      previousSha,
    ).then(() => "success");
  }

  // STEP 1: Draft
  if (stepsState.write.state !== "passed") {
    if (stepsState.write.isDraft) {
      return createPendingStatusCheck("PR is still in draft");
    }
    if (stepsState.write.isClosed) {
      return createFailedStatusCheck("PR is closed");
    }
    return createFailedStatusCheck("Write step failed, unknown reason");
  }

  // bypass
  const bypassProgressLabel = repoContext.labels["merge/bypass-progress"];
  if (bypassProgressLabel && hasLabelInPR(prLabels, bypassProgressLabel)) {
    return addStatusCheck(
      pullRequest,
      context,
      appContext,
      reviewflowPrContext,
      {
        state: "success",
        description: "⚠️ PR merge bypass",
      },
      previousSha,
    ).then(() => "success");
  }

  // STEP 2: CHECKS
  const automergeLabel = repoContext.labels["merge/automerge"];

  const shouldEnforceProgress = repoContext.config
    .onlyEnforceProgressWhenAutomergeEnabled
    ? automergeLabel && hasLabelInPR(prLabels, automergeLabel)
    : true;

  if (shouldEnforceProgress && stepsState.checks.state !== "passed") {
    if (stepsState.checks.isFailed) {
      let failedChecksAndStatuses: string[] = [];

      if (
        reviewflowPrContext.reviewflowPr.checksConclusion &&
        reviewflowPrContext.reviewflowPr.statusesConclusion
      ) {
        const { failedChecks, failedStatuses } =
          getFailedOrWaitingChecksAndStatuses(
            {
              checksConclusionRecord:
                reviewflowPrContext.reviewflowPr.checksConclusion,
              statusesConclusionRecord:
                reviewflowPrContext.reviewflowPr.statusesConclusion,
            },
            repoContext,
          );

        failedChecksAndStatuses = [...failedChecks, ...failedStatuses];
      }
      return createFailedStatusCheck(
        `Checks failed${
          failedChecksAndStatuses.length > 0
            ? `: ${failedChecksAndStatuses.join(", ")}`
            : ""
        }`,
      );
    }

    if (stepsState.checks.isInProgress) {
      return createPendingStatusCheck("Checks in progress");
    }
  }

  // STEP 3: Code Review
  if (shouldEnforceProgress && stepsState.codeReview.state !== "passed") {
    if (
      stepsState.codeReview.hasRequestedReviewers ||
      stepsState.codeReview.hasRequestedTeams
    ) {
      return createPendingStatusCheck(
        `Awaiting review from: ${[
          ...(pullRequest.requested_reviewers || []),
          ...(pullRequest.requested_teams || []),
        ]
          .map((rr) => {
            if (!rr) return undefined;
            return "name" in rr ? rr.name : rr.login;
          })
          .filter(ExcludesFalsy)
          .join(", ")}`,
      );
    }

    if (stepsState.codeReview.hasChangesRequested) {
      return createFailedStatusCheck(
        "Changes requested ! Push commits or discuss changes then re-request a review.",
      );
    }
  }

  if (shouldEnforceProgress && stepsState.codeReview.isMissingApprobation) {
    return createFailedStatusCheck(
      "Awaiting review... Perhaps request someone ?",
    );
  }

  // if (
  //   repoContext.config.requiresReviewRequest &&
  //   !repoContext.hasRequestedReview(labels)
  // ) {
  //   return  createFailedStatusCheck(
  //     context,
  //     pr,
  //     'You need to request someone to review the PR',
  //   );
  //   return;
  // }
  // return  createInProgressStatusCheck(context);
  // } else if (repoContext.hasApprovesReview(labels)) {
  return addStatusCheck(
    pullRequest,
    context,
    appContext,
    reviewflowPrContext,
    {
      state: "success",
      description: shouldEnforceProgress
        ? "✓ PR ready to merge !"
        : "✓ Automerge can be enabled",
    },
    previousSha,
  ).then(() => "success");
  // }
};
