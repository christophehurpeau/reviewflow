import type { RepoContext } from "../../../../../context/repoContext";
import type { PullRequestWithDecentData } from "../../../utils/PullRequestData";
import type { ReviewflowPrContext } from "../../../utils/createPullRequestContext";

export type StepState = "failed" | "in-progress" | "not-started" | "passed";

export interface BaseStepState {
  state: StepState;
}

export interface CalcStepOptions<TeamNames extends string> {
  repoContext: RepoContext<TeamNames>;
  pullRequest: PullRequestWithDecentData;
  reviewflowPrContext: ReviewflowPrContext;
}
