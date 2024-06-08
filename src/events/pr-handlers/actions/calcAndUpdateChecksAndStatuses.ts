import type { AppContext } from "../../../context/AppContext";
import type {
  EventsWithRepository,
  RepoContext,
} from "../../../context/repoContext";
import type { CreateOwnerPartOptions } from "../../../slack/utils";
import { createOwnerPart, createPrLink } from "../../../slack/utils";
import type { ProbotEvent } from "../../probot-types";
import type {
  PullRequestFromRestEndpoint,
  PullRequestLabels,
} from "../utils/PullRequestData";
import type { ReviewflowPrContext } from "../utils/createPullRequestContext";
import type { FailedOrWaitingChecksAndStatuses } from "../utils/getFailedOrWaitingChecksAndStatuses";
import { getFailedOrWaitingChecksAndStatuses } from "../utils/getFailedOrWaitingChecksAndStatuses";
import { getOwnersFromPullRequest } from "../utils/getRolesFromPullRequestAndReviewers";
import { updateCommentBodyProgressFromStepsState } from "./updateCommentBodyProgressFromStepsState";
import { updateStatusCheckFromStepsState } from "./updateStatusCheckFromStepsState";
import { getStateChecksLabelsToSync } from "./utils/labels/getStateChecksLabelsToSync";
import {
  markAsDoneSlackSentMessages,
  sendOrUpdateSlackMessage,
} from "./utils/slackUtils";
import { calcStepsState } from "./utils/steps/calcStepsState";
import { syncLabels } from "./utils/syncLabel";

async function checksAndStatusesSlackMessageAddOrUpdate<
  TeamNames extends string,
>(
  appContext: AppContext,
  repoContext: RepoContext<TeamNames>,
  reviewflowPrContext: ReviewflowPrContext,
  pullRequest: PullRequestFromRestEndpoint,
  failedOrWaitingChecksAndStatuses: FailedOrWaitingChecksAndStatuses,
  previousSha?: string,
): Promise<void> {
  if (!repoContext.slack) return;

  const type = "pr-checksAndStatuses";

  if (previousSha) {
    const previousShaTypeId = `${repoContext.repoEmbed.id}_${pullRequest.id}_${previousSha}`;
    await markAsDoneSlackSentMessages(appContext, repoContext, {
      type,
      typeId: previousShaTypeId,
    });
    return;
  }

  const { state } = failedOrWaitingChecksAndStatuses;
  const typeId = `${repoContext.repoEmbed.id}_${pullRequest.id}_${reviewflowPrContext.reviewflowPr.headSha}`;

  switch (state) {
    case "passed": {
      await markAsDoneSlackSentMessages(appContext, repoContext, {
        type,
        typeId,
      });

      break;
    }
    case "failed": {
      const createText = (
        createOwnerPartOptions: CreateOwnerPartOptions,
      ): string => {
        const prLink = createPrLink(pullRequest, repoContext);
        const prOwnership = createOwnerPart(
          repoContext,
          pullRequest,
          createOwnerPartOptions,
        );

        const failedChecksAndStatuses = [
          ...failedOrWaitingChecksAndStatuses.failedChecks,
          ...failedOrWaitingChecksAndStatuses.failedStatuses,
        ];
        const failedChecksAndStatusesString = failedChecksAndStatuses
          .map((failedCheckOrStatusName) => `\`${failedCheckOrStatusName}\``)
          .join(", ");

        return `:red_circle: Check${
          failedChecksAndStatuses.length > 1 ? "s" : ""
        } ${failedChecksAndStatusesString} failed on ${prOwnership} ${prLink}`;
      };

      const isPrClosed = !!pullRequest.closed_at;

      const { owner, assigneesNotOwner } =
        getOwnersFromPullRequest(pullRequest);
      await Promise.all([
        sendOrUpdateSlackMessage(
          appContext,
          repoContext,
          {
            type,
            typeId,
            messageId: "owner",
            messageCategory: "pr-checksAndStatuses",
            message: {
              text: createText({ isOwner: true }),
            },
            sendTo: [owner],
          },
          !isPrClosed,
        ),
        sendOrUpdateSlackMessage(
          appContext,
          repoContext,
          {
            type,
            typeId,
            messageId: "assignees",
            messageCategory: "pr-checksAndStatuses",
            message: {
              text: createText({ isAssigned: true }),
            },
            sendTo: assigneesNotOwner,
          },
          !isPrClosed,
        ),
      ]);
      break;
    }
    case "pending": {
      // if state is pending, we wait for resolution before creating/updating the message
      // Note that a pr can go back to pending when the ci triggers another job or a github app adds a pending status or check.
      // When a new commit is pushed, the sha changes.
      break;
    }

    // no default
  }
}

export async function calcAndUpdateChecksAndStatuses<
  EventName extends EventsWithRepository,
  TeamNames extends string,
>(
  context: ProbotEvent<EventName>,
  appContext: AppContext,
  repoContext: RepoContext<TeamNames>,
  pullRequest: PullRequestFromRestEndpoint,
  reviewflowPrContext: ReviewflowPrContext,
  updateStatusCheckAndBodyProgress = true,
  previousSha?: string,
): Promise<PullRequestLabels> {
  if (
    !reviewflowPrContext.reviewflowPr.checksConclusion ||
    !reviewflowPrContext.reviewflowPr.statusesConclusion
  ) {
    return pullRequest.labels;
  }

  const failedOrWaitingChecksAndStatuses = getFailedOrWaitingChecksAndStatuses(
    {
      checksConclusionRecord: reviewflowPrContext.reviewflowPr.checksConclusion,
      statusesConclusionRecord:
        reviewflowPrContext.reviewflowPr.statusesConclusion,
    },
    repoContext,
  );

  const slackMessageAddOrUpdatePromise =
    checksAndStatusesSlackMessageAddOrUpdate(
      appContext,
      repoContext,
      reviewflowPrContext,
      pullRequest,
      failedOrWaitingChecksAndStatuses,
      previousSha,
    );

  const { state } = failedOrWaitingChecksAndStatuses;

  const updatedLabels = await syncLabels(
    pullRequest,
    context,
    getStateChecksLabelsToSync(repoContext, state),
  );

  if (updateStatusCheckAndBodyProgress) {
    const stepsState = calcStepsState({
      repoContext,
      pullRequest,
      reviewflowPrContext,
    });

    await Promise.all([
      updateStatusCheckFromStepsState(
        stepsState,
        pullRequest,
        context,
        repoContext,
        appContext,
        reviewflowPrContext,
        updatedLabels,
      ),
      updateCommentBodyProgressFromStepsState(
        stepsState,
        context,
        reviewflowPrContext,
      ),
    ]);
  }

  await slackMessageAddOrUpdatePromise;

  return updatedLabels;
}
