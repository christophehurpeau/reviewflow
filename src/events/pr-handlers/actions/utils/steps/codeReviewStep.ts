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
  const hasApproves = repoContext.hasApprovesReview(labels);
  const needsReviewGroupNames = repoContext.getNeedsReviewGroupNames(labels);
  const isMissingApprobation =
    repoContext.config.requiresReviewRequest ||
    pullRequest.user?.type === 'Bot' ||
    pullRequest.user?.id !== repoContext.accountEmbed.id
      ? !repoContext.hasApprovesReview(labels)
      : false;

  return {
    state: (() => {
      if (hasChangesRequested) return 'failed';
      if (hasRequestedReviewers || hasRequestedTeams) return 'in-progress';
      if (needsReviewGroupNames.length === 0 && !isMissingApprobation) {
        return 'passed';
      }
      if (hasApproves) return 'in-progress';
      return 'not-started';
    })(),
    hasRequestedReviewers,
    hasRequestedTeams,
    hasChangesRequested,
    needsReviewGroupNames,
    isMissingApprobation,
  };
}
