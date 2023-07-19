import type { BaseStepState, CalcStepOptions } from './BaseStepState';

// TODO if was pr draft, requires a new review

export interface CodeReviewStepState extends BaseStepState {
  hasRequestedReviewers: boolean;
  hasRequestedTeams: boolean;
  hasChangesRequested: boolean;
  hasApprovals: boolean;
  isMissingReview: boolean;
  isMissingApprobation: boolean;
  isApproved: boolean;
}

export function calcCodeReviewStep<TeamNames extends string>({
  repoContext,
  pullRequest,
  reviewflowPrContext,
}: CalcStepOptions<TeamNames>): CodeReviewStepState {
  const hasRequestedReviewers = Boolean(
    pullRequest.requested_reviewers &&
      pullRequest.requested_reviewers.length > 0,
  );
  const hasRequestedTeams = Boolean(
    pullRequest.requested_teams && pullRequest.requested_teams.length > 0,
  );

  const hasChangesRequested =
    reviewflowPrContext.reviewflowPr.reviews?.changesRequested.length > 0;

  const hasApprovals =
    reviewflowPrContext.reviewflowPr.reviews?.approved.length > 0;

  const isMissingApprobation =
    repoContext.config.requiresReviewRequest ||
    pullRequest.user?.type === 'Bot' ||
    pullRequest.user?.id !== repoContext.accountEmbed.id
      ? !hasApprovals
      : false;

  const isMissingReview =
    !pullRequest.draft &&
    !pullRequest.closed_at &&
    (hasRequestedReviewers ||
      hasRequestedReviewers ||
      !!(isMissingApprobation && repoContext.config.requiresReviewRequest));

  const isApproved =
    hasApprovals &&
    !isMissingApprobation &&
    !hasRequestedReviewers &&
    !hasRequestedTeams;

  return {
    state: (() => {
      if (hasChangesRequested) return 'failed';
      if (hasRequestedReviewers || hasRequestedTeams || hasChangesRequested) {
        return 'in-progress';
      }
      if (!isMissingApprobation) {
        return 'passed';
      }
      if (hasApprovals) return 'in-progress';
      return 'not-started';
    })(),
    isMissingReview,
    hasRequestedReviewers,
    hasRequestedTeams,
    hasChangesRequested,
    hasApprovals,
    isMissingApprobation,
    isApproved,
  };
}
