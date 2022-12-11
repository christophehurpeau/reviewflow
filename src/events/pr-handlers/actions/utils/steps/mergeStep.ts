import type { BaseStepState, CalcStepOptions } from './BaseStepState';

export interface MergeStepState extends BaseStepState {
  isMerged: boolean;
}

export function calcMergeStep<GroupNames extends string>({
  repoContext,
  pullRequest,
  labels,
}: CalcStepOptions<GroupNames>): MergeStepState {
  const isMerged = !!pullRequest.merged_at;

  return {
    pass: isMerged,
    isMerged,
  };
}
