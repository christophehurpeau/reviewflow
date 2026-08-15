import type { BasicUser } from "reviewflow-core";
import type {
  EventsWithRepository,
  RepoContext,
  RescheduleTime,
} from "../../../context/repoContext.ts";
import type { ProbotEvent } from "../../probot-types.ts";
import type { PullRequestLabels } from "../utils/PullRequestData.ts";
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

interface TryToAutomergeFromRescheduleOptions<
  EventName extends EventsWithRepository,
  TeamNames extends string,
> {
  pullRequest: PullRequestFromRestEndpoint;
  context: ProbotEvent<EventName>;
  repoContext: RepoContext<TeamNames>;
  reviewflowPrContext: ReviewflowPrContext;
  user?: BasicUser;
  fromRescheduleTime: RescheduleTime;
  fromRescheduleAttempt: number;
}

/*
 * A reschedule can be created without knowing the labels of the pull request
 * (`rescheduleOnChecksUpdated` from a check suite), and the automerge label can be removed while
 * a reschedule is pending. The opt-in is therefore checked again here, on the freshly fetched
 * pull request, as this is the path that actually merges.
 * `skipCheckMergeableState` is intentionally false: rescheduling again when the pull request is
 * already mergeable would only loop.
 */
export async function tryToAutomergeFromReschedule<
  EventName extends EventsWithRepository,
  TeamNames extends string,
>({
  pullRequest,
  context,
  repoContext,
  reviewflowPrContext,
  user,
  fromRescheduleTime,
  fromRescheduleAttempt,
}: TryToAutomergeFromRescheduleOptions<
  EventName,
  TeamNames
>): Promise<MergeOrEnableGithubAutoMergeResult> {
  const autoMergeLabel = repoContext.labels["merge/automerge"];

  if (!hasLabelInPR(pullRequest.labels, autoMergeLabel)) {
    context.log.info(
      { repo: repoContext.repoFullName, prNumber: pullRequest.number },
      "reschedule: automerge is not enabled on this pull request, skipping",
    );
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
    false,
    fromRescheduleTime,
    fromRescheduleAttempt,
  );
}
