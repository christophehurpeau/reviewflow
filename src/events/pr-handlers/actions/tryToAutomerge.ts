import type {
  EventsWithRepository,
  RepoContext,
} from "../../../context/repoContext.ts";
import type { ProbotEvent } from "../../probot-types.ts";
import type { BasicUser, PullRequestLabels } from "../utils/PullRequestData.ts";
import type { ReviewflowPrContext } from "../utils/createPullRequestContext.ts";
import type { PullRequestFromRestEndpoint } from "../utils/fetchPr.ts";
import type { MergeOrEnableGithubAutoMergeResult } from "./enableGithubAutoMerge.ts";
import { mergeOrEnableGithubAutoMerge } from "./enableGithubAutoMerge.ts";
import hasLabelInPR from "./utils/labels/hasLabelInPR.ts";
import type { StepsState } from "./utils/steps/calcStepsState.ts";
import {
  calcStepsState,
  isAllStepsExceptMergePassed,
} from "./utils/steps/calcStepsState.ts";

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

  if (!repoContext.settings.allowAutoMerge) {
    return { wasMerged: false };
  }

  return mergeOrEnableGithubAutoMerge(
    pullRequest,
    context,
    repoContext,
    reviewflowPrContext,
    user,
    !isAllStepsExceptMergePassed(stepsState),
  );
}
