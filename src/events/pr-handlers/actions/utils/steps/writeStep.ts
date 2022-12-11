import type { BaseStepState, CalcStepOptions } from './BaseStepState';

export interface WriteStepState extends BaseStepState {
  isDraft: boolean;
  isClosed: boolean;
}

export function calcWriteStep<GroupNames extends string>({
  pullRequest,
}: CalcStepOptions<GroupNames>): WriteStepState {
  const isDraft = !!pullRequest.draft;
  const isClosed = !!pullRequest.closed_at;

  return {
    pass: !isDraft,
    isDraft,
    isClosed,
  };
}
