import type { RepoContext } from 'context/repoContext';
import type {
  PullRequestWithDecentData,
  PullRequestLabels,
} from 'events/pr-handlers/utils/PullRequestData';
import type { ReviewflowPrContext } from 'events/pr-handlers/utils/createPullRequestContext';
import type { ChecksStepState } from './checksStep';
import { calcChecksStep } from './checksStep';
import type { CodeReviewStepState } from './codeReviewStep';
import { calcCodeReviewStep } from './codeReviewStep';
import type { MergeStepState } from './mergeStep';
import { calcMergeStep } from './mergeStep';
import type { WriteStepState } from './writeStep';
import { calcWriteStep } from './writeStep';

export interface CalcStepsStateOptions<GroupNames extends string> {
  repoContext: RepoContext<GroupNames>;
  reviewflowPrContext: ReviewflowPrContext;
  pullRequest: PullRequestWithDecentData;
  labels?: PullRequestLabels;
}

export interface StepsState<GroupNames extends string> {
  write: WriteStepState;
  checks: ChecksStepState;
  codeReview: CodeReviewStepState<GroupNames>;
  merge: MergeStepState;
}

// TODO update pr comment when necessary to update this: reviewRequested, etc...
// try to look next to updateStatusCheckFromStepsState and when editOpenedPR is not called
export const steps = [
  {
    name: 'Step 1: ✏️ Write code',
    key: 'write',
    fn: calcWriteStep,
  },
  {
    name: 'Step 2: 💚 Checks',
    key: 'checks',
    fn: calcChecksStep,
  },
  {
    name: 'Step 3: 👌 Code Review',
    key: 'codeReview',
    fn: calcCodeReviewStep,
  },
  {
    name: 'Step 4: 🚦 Merge Pull Request',
    key: 'merge',
    fn: calcMergeStep,
  },
] as const;

export function calcStepsState<GroupNames extends string>({
  repoContext,
  reviewflowPrContext,
  pullRequest,
  labels = pullRequest.labels,
}: CalcStepsStateOptions<GroupNames>): StepsState<GroupNames> {
  const stepsState: Partial<StepsState<GroupNames>> = {};

  for (const step of steps) {
    stepsState[step.key] = step.fn({
      repoContext,
      pullRequest,
      reviewflowPrContext,
      labels,
    }) as any;
  }

  return stepsState as StepsState<GroupNames>;
}
