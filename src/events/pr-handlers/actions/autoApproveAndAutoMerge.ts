import type { EventsWithRepository, RepoContext } from 'context/repoContext';
import type { ProbotEvent } from 'events/probot-types';
import type { PullRequestFromRestEndpoint } from '../utils/PullRequestData';
import type { ReviewflowPrContext } from '../utils/createPullRequestContext';
import { autoMergeIfPossible } from './autoMergeIfPossible';
import hasLabelInPR from './utils/labels/hasLabelInPR';

export const autoApproveAndAutoMerge = async <
  Name extends EventsWithRepository,
>(
  pullRequest: PullRequestFromRestEndpoint,
  context: ProbotEvent<Name>,
  repoContext: RepoContext,
  reviewflowPrContext: ReviewflowPrContext,
  ignoreLabel = false,
): Promise<boolean> => {
  // const autoMergeLabel = repoContext.labels['merge/automerge'];
  const codeApprovedLabel = repoContext.labels['code/approved'];
  if (ignoreLabel || hasLabelInPR(pullRequest.labels, codeApprovedLabel)) {
    await context.octokit.pulls.createReview(
      context.pullRequest({ event: 'APPROVE' }),
    );
    await autoMergeIfPossible(
      pullRequest,
      context,
      repoContext,
      reviewflowPrContext,
    );
    return true;
  }

  return false;
};
