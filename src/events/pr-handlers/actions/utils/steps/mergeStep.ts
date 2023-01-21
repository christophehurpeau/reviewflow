import type { BaseStepState, CalcStepOptions } from './BaseStepState';

export interface MergeStepState extends BaseStepState {
  isMerged: boolean;
  isClosed: boolean;
}

export function calcMergeStep<GroupNames extends string>({
  repoContext,
  pullRequest,
  labels,
}: CalcStepOptions<GroupNames>): MergeStepState {
  const isMerged = !!pullRequest.merged_at;
  const isClosed = !!pullRequest.closed_at;

  return {
    state: (() => {
      if (isMerged) return 'passed';
      if (isClosed) return 'failed';
      if (pullRequest.auto_merge) return 'in-progress';
      return 'not-started';
    })(),
    isMerged,
    isClosed,
  };
}
