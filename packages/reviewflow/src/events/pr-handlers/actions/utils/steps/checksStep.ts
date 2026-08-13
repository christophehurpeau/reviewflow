import { getFailedOrWaitingChecksAndStatuses } from "../../../utils/getFailedOrWaitingChecksAndStatuses.ts";
import type { BaseStepState, CalcStepOptions } from "./BaseStepState.ts";

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
    state: state === "pending" ? "in-progress" : state,
    isInProgress: state === "pending",
    isFailed: state === "failed",
  };
}
