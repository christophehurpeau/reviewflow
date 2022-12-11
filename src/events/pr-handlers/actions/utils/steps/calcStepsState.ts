import type { Except } from 'type-fest';
import type { RepoContext } from 'context/repoContext';
import type { PullRequestWithDecentData } from 'events/pr-handlers/utils/PullRequestData';
import type { CodeReviewStepState } from './codeReviewStep';
import { calcCodeReviewStep } from './codeReviewStep';
import type { WriteStepState } from './writeStep';
import { calcWriteStep } from './writeStep';

export interface CalcStepsStateOptions<GroupNames extends string> {
  repoContext: RepoContext<GroupNames>;
  pullRequest: PullRequestWithDecentData;
  labels?: PullRequestWithDecentData['labels'];
  bail?: boolean;
}

export interface StepsState<GroupNames extends string = any> {
  write: WriteStepState;
  codeReview: CodeReviewStepState<GroupNames>;
}

const steps = [
  {
    name: 'Step 1: ✏️ Write code',
    key: 'write',
    fn: calcWriteStep,
  },
  // Step 2: ✅ CI passes
  {
    name: 'Step 3: 👌 Code Review',
    key: 'codeReview',
    fn: calcCodeReviewStep,
  },
] as const;

export function calcStepsState<
  GroupNames extends string,
  Options extends CalcStepsStateOptions<GroupNames>,
>(
  {
    repoContext,
    pullRequest,
    labels = pullRequest.labels,
    bail = false,
  }: Options = {} as Options,
): Options['bail'] extends true
  ? Partial<StepsState<GroupNames>>
  : StepsState<GroupNames> {
  const stepsState: Partial<StepsState<GroupNames>> = {};

  for (const step of steps) {
    stepsState[step.key] = step.fn({ repoContext, pullRequest, labels }) as any;
    if (bail) return stepsState as StepsState<GroupNames>;
  }

  return stepsState as StepsState<GroupNames>;
}

export function updateStepsState<GroupNames extends string>(
  stepsState: StepsState<GroupNames>,
  stepKeys: (keyof StepsState<GroupNames>)[],
  {
    repoContext,
    pullRequest,
    labels = pullRequest.labels,
  }: Except<CalcStepsStateOptions<GroupNames>, 'bail'>,
): StepsState<GroupNames> {
  const updatedStepsState = { ...stepsState };

  for (const step of steps) {
    if (stepKeys.includes(step.key)) {
      stepsState[step.key] = step.fn({
        repoContext,
        pullRequest,
        labels,
      }) as any;
    }
  }

  return updatedStepsState;
}
