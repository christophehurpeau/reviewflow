import type { BaseStepState, CalcStepOptions } from './BaseStepState';

export interface ChecksStepState extends BaseStepState {
  isInProgress: boolean;
  isFailed: boolean;
}

export function calcChecksStep<GroupNames extends string>({
  repoContext,
  pullRequest,
  labels,
}: CalcStepOptions<GroupNames>): ChecksStepState {
  const labelChecksInProgress = repoContext.labels['checks/in-progress'];
  const labelChecksFailed = repoContext.labels['checks/failed'];
  const isInProgress = Boolean(
    labelChecksInProgress &&
      labels.some((l) => l.id === labelChecksInProgress.id),
  );
  const isFailed = Boolean(
    labelChecksInProgress && labels.some((l) => l.id === labelChecksFailed.id),
  );

  return {
    state: (() => {
      if (isFailed) return 'failed';
      if (isInProgress) return 'in-progress';
      return 'passed';
    })(),
    isInProgress,
    isFailed,
  };
}
