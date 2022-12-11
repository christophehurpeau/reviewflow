import type { BaseStepState, CalcStepOptions } from './BaseStepState';

export interface CodeReviewStepState<GroupNames extends string>
  extends BaseStepState {
  hasRequestedReviewers: boolean;
  hasRequestedTeams: boolean;
  hasChangesRequested: boolean;
  needsReviewGroupNames: GroupNames[];
  isMissingApprobation: boolean;
}

export function calcCodeReviewStep<GroupNames extends string>({
  repoContext,
  pullRequest,
  labels,
}: CalcStepOptions<GroupNames>): CodeReviewStepState<GroupNames> {
  const hasRequestedReviewers = Boolean(
    pullRequest.requested_reviewers &&
      pullRequest.requested_reviewers.length > 0,
  );
  const hasRequestedTeams = Boolean(
    pullRequest.requested_teams && pullRequest.requested_teams.length > 0,
  );
  const hasChangesRequested = repoContext.hasChangesRequestedReview(labels);
  const needsReviewGroupNames = repoContext.getNeedsReviewGroupNames(labels);
  const isMissingApprobation = repoContext.config.requiresReviewRequest
    ? !repoContext.hasApprovesReview(labels)
    : false;

  return {
    pass:
      !hasRequestedReviewers &&
      !hasRequestedTeams &&
      !hasChangesRequested &&
      needsReviewGroupNames.length === 0 &&
      !isMissingApprobation,
    hasRequestedReviewers,
    hasRequestedTeams,
    hasChangesRequested,
    needsReviewGroupNames,
    isMissingApprobation,
  };
}
