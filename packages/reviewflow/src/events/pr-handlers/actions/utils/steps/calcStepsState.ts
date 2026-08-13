import type { RepoContext } from "../../../../../context/repoContext.ts";
import type { PullRequestWithDecentData } from "../../../utils/PullRequestData.ts";
import type { ReviewflowPrContext } from "../../../utils/createPullRequestContext.ts";
import type { ChecksStepState } from "./checksStep.ts";
import { calcChecksStep } from "./checksStep.ts";
import type { CodeReviewStepState } from "./codeReviewStep.ts";
import { calcCodeReviewStep } from "./codeReviewStep.ts";
import type { MergeStepState } from "./mergeStep.ts";
import { calcMergeStep } from "./mergeStep.ts";
import type { WriteStepState } from "./writeStep.ts";
import { calcWriteStep } from "./writeStep.ts";

export interface CalcStepsStateOptions<TeamNames extends string> {
  repoContext: RepoContext<TeamNames>;
  reviewflowPrContext: ReviewflowPrContext;
  pullRequest: PullRequestWithDecentData;
}

export interface StepsState {
  write: WriteStepState;
  checks: ChecksStepState;
  codeReview: CodeReviewStepState;
  merge: MergeStepState;
}

// TODO update pr comment when necessary to update this: reviewRequested, etc...
// try to look next to updateStatusCheckFromStepsState and when editOpenedPR is not called
export const steps = [
  {
    name: "Step 1: ✏️ Write code",
    key: "write",
    fn: calcWriteStep,
  },
  {
    name: "Step 2: 💚 Checks",
    key: "checks",
    fn: calcChecksStep,
  },
  {
    name: "Step 3: 👌 Code Review",
    key: "codeReview",
    fn: calcCodeReviewStep,
  },
  {
    name: "Step 4: 🚦 Merge Pull Request",
    key: "merge",
    fn: calcMergeStep,
  },
] as const;

export function calcStepsState<TeamNames extends string>({
  repoContext,
  reviewflowPrContext,
  pullRequest,
}: CalcStepsStateOptions<TeamNames>): StepsState {
  const stepsState: Partial<StepsState> = {};

  for (const step of steps) {
    stepsState[step.key] = step.fn({
      repoContext,
      pullRequest,
      reviewflowPrContext,
    }) as any;
  }

  return stepsState as StepsState;
}

export function isAllStepsExceptMergePassed(stepsState: StepsState): boolean {
  return steps.every(
    ({ key }) => key === "merge" || stepsState[key].state === "passed",
  );
}
