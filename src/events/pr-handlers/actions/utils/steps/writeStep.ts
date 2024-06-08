import type { BaseStepState, CalcStepOptions } from "./BaseStepState";

export interface WriteStepState extends BaseStepState {
  isDraft: boolean;
  isClosed: boolean;
}

export function calcWriteStep<TeamNames extends string>({
  pullRequest,
}: CalcStepOptions<TeamNames>): WriteStepState {
  const isDraft = !!pullRequest.draft;
  const isClosed = !!pullRequest.closed_at;

  return {
    state: (() => {
      if (isDraft) return "in-progress";
      return "passed";
    })(),
    isDraft,
    isClosed,
  };
}
