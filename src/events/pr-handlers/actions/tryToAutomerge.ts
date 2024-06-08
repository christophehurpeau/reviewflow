import type {
  EventsWithRepository,
  RepoContext,
} from "../../../context/repoContext";
import type { ProbotEvent } from "../../probot-types";
import type { BasicUser, PullRequestLabels } from "../utils/PullRequestData";
import type { ReviewflowPrContext } from "../utils/createPullRequestContext";
import type { PullRequestFromRestEndpoint } from "../utils/fetchPr";
import { autoMergeIfPossibleLegacy } from "./autoMergeIfPossible";
import type { MergeOrEnableGithubAutoMergeResult } from "./enableGithubAutoMerge";
import { mergeOrEnableGithubAutoMerge } from "./enableGithubAutoMerge";
import hasLabelInPR from "./utils/labels/hasLabelInPR";
import type { StepsState } from "./utils/steps/calcStepsState";
import {
  calcStepsState,
  isAllStepsExceptMergePassed,
} from "./utils/steps/calcStepsState";

interface TryToAutomergeOptions<
  EventName extends EventsWithRepository,
  TeamNames extends string,
> {
  pullRequest: PullRequestFromRestEndpoint;
  context: ProbotEvent<EventName>;
  repoContext: RepoContext<TeamNames>;
  reviewflowPrContext: ReviewflowPrContext;
  stepsState?: StepsState;
  pullRequestLabels?: PullRequestLabels;
  user?: BasicUser;
}

export async function tryToAutomerge<
  EventName extends EventsWithRepository,
  TeamNames extends string,
>({
  pullRequest,
  pullRequestLabels = pullRequest.labels,
  context,
  repoContext,
  reviewflowPrContext,
  stepsState = calcStepsState({
    pullRequest,
    repoContext,
    reviewflowPrContext,
  }),
  user = context.payload.sender,
}: TryToAutomergeOptions<
  EventName,
  TeamNames
>): Promise<MergeOrEnableGithubAutoMergeResult> {
  const autoMergeLabel = repoContext.labels["merge/automerge"];

  if (!hasLabelInPR(pullRequestLabels, autoMergeLabel)) {
    return { wasMerged: false, didFailedToEnableAutoMerge: true };
  }

  if (repoContext.settings.allowAutoMerge) {
    return mergeOrEnableGithubAutoMerge(
      pullRequest,
      context,
      repoContext,
      reviewflowPrContext,
      user,
      !isAllStepsExceptMergePassed(stepsState),
    );
  } else {
    if (!isAllStepsExceptMergePassed(stepsState)) {
      return {
        wasMerged: false,
      };
    }

    const wasMerged = await autoMergeIfPossibleLegacy(
      pullRequest,
      context,
      repoContext,
      reviewflowPrContext,
    );

    return { wasMerged };
  }
}
