import { getFailedOrWaitingChecksAndStatuses } from '../../../utils/getFailedOrWaitingChecksAndStatuses';
import type { BaseStepState, CalcStepOptions } from './BaseStepState';

export interface ChecksStepState extends BaseStepState {
  isInProgress: boolean;
  isFailed: boolean;
}

export function calcChecksStep<TeamNames extends string>({
  repoContext,
  reviewflowPrContext,
}: CalcStepOptions<TeamNames>): ChecksStepState {
  const { state } = getFailedOrWaitingChecksAndStatuses(
    {
      checksConclusionRecord:
        reviewflowPrContext.reviewflowPr.checksConclusion || {},
      statusesConclusionRecord:
        reviewflowPrContext.reviewflowPr.statusesConclusion || {},
    },
    repoContext,
  );

  return {
    state: state === 'pending' ? 'in-progress' : state,
    isInProgress: state === 'pending',
    isFailed: state === 'failed',
  };
}
