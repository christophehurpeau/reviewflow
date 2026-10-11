import type { ReviewState } from "reviewflow-core";
import type { CodeReviewStepState } from "./codeReviewStep.ts";

/**
 * Changes requested wins over a pending request. Approvals that do not satisfy
 * the repo rules (`restrictAutoMergeTo`) still leave a review to obtain:
 * `requested`.
 */
export function toReviewState({
  hasChangesRequested,
  hasRequestedReviewers,
  hasRequestedTeams,
  hasApprovals,
  isApproved,
}: CodeReviewStepState): ReviewState {
  if (hasChangesRequested) return "changesRequested";
  if (hasRequestedReviewers || hasRequestedTeams) return "requested";
  if (isApproved) return "approved";
  if (hasApprovals) return "requested";
  return "none";
}
