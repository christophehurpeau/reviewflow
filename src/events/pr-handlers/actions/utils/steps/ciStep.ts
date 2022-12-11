import type { BaseStepState, CalcStepOptions } from './BaseStepState';

export interface CIStepState extends BaseStepState {
  _: boolean;
}

export function calcCIStep<GroupNames extends string>({
  repoContext,
  pullRequest,
  labels,
}: CalcStepOptions<GroupNames>): CIStepState {
  return {
    pass: true,
    _: false,
  };
}
