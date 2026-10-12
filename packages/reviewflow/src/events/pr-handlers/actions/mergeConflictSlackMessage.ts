import type { PrMergeable } from "reviewflow-modules";
import type { AppContext } from "../../../context/AppContext.ts";
import type { RepoContext } from "../../../context/repoContext.ts";
import type { CreateOwnerPartOptions } from "../../../slack/utils.ts";
import { createOwnerPart, createPrLink } from "../../../slack/utils.ts";
import type { PullRequestWithDecentData } from "../utils/PullRequestData.ts";
import { getOwnersFromPullRequest } from "../utils/getRolesFromPullRequestAndReviewers.ts";
import {
  markAsDoneSlackSentMessages,
  sendOrUpdateSlackMessage,
} from "./utils/slackUtils.ts";

const type = "pr-merge-conflicts";

/** per pull request, not per sha: a conflict outlives the pushes that do not resolve it */
const createTypeId = (
  repoContext: RepoContext,
  pullRequestId: number,
): string => `${repoContext.repoEmbed.id}_${pullRequestId}`;

export const markMergeConflictAsDone = async (
  appContext: AppContext,
  repoContext: RepoContext,
  pullRequestId: number,
): Promise<void> => {
  if (!repoContext.slack) return;

  await markAsDoneSlackSentMessages(appContext, repoContext, {
    type,
    typeId: createTypeId(repoContext, pullRequestId),
  });
};

const notifyMergeConflict = async (
  appContext: AppContext,
  repoContext: RepoContext,
  pullRequest: PullRequestWithDecentData,
): Promise<void> => {
  const typeId = createTypeId(repoContext, pullRequest.id);
  const createText = (createOwnerPartOptions: CreateOwnerPartOptions): string =>
    `:warning: Merge conflict on ${createOwnerPart(
      repoContext,
      pullRequest,
      createOwnerPartOptions,
    )} ${createPrLink(pullRequest, repoContext)} with \`${pullRequest.base.ref}\``;

  const isPrClosed = !!pullRequest.closed_at;
  const { owner, assigneesNotOwner } = getOwnersFromPullRequest(pullRequest);

  await Promise.all([
    owner &&
      sendOrUpdateSlackMessage(
        appContext,
        repoContext,
        {
          type,
          typeId,
          messageId: "owner",
          messageCategory: "pr-merge-conflicts",
          message: { text: createText({ isOwner: true }) },
          sendTo: [owner],
        },
        !isPrClosed,
      ),
    assigneesNotOwner &&
      sendOrUpdateSlackMessage(
        appContext,
        repoContext,
        {
          type,
          typeId,
          messageId: "assignees",
          messageCategory: "pr-merge-conflicts",
          message: { text: createText({ isAssigned: true }) },
          sendTo: assigneesNotOwner,
        },
        !isPrClosed,
      ),
  ]);
};

interface SyncMergeConflictSlackMessageOptions {
  pullRequest: PullRequestWithDecentData;
  mergeable: PrMergeable;
}

export const syncMergeConflictSlackMessage = async (
  appContext: AppContext,
  repoContext: RepoContext,
  { pullRequest, mergeable }: SyncMergeConflictSlackMessageOptions,
): Promise<void> => {
  if (!repoContext.slack) return;

  switch (mergeable) {
    case "conflicting": {
      await notifyMergeConflict(appContext, repoContext, pullRequest);
      break;
    }
    case "mergeable": {
      await markMergeConflictAsDone(appContext, repoContext, pullRequest.id);
      break;
    }
    case "unknown": {
      // github is still computing it: neither a conflict nor a resolution
      break;
    }

    // no default
  }
};
