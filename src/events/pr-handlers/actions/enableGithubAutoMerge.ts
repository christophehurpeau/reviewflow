import type { EventsWithRepository, RepoContext } from 'context/repoContext';
import type { AutoMergeRequest } from '../../../utils/github/pullRequest/autoMerge';
import {
  enableGithubAutoMergeMutation,
  disableGithubAutoMergeMutation,
} from '../../../utils/github/pullRequest/autoMerge';
import type { ProbotEvent } from '../../probot-types';
import type { PullRequestWithDecentData } from '../utils/PullRequestData';
import type { ReviewflowPrContext } from '../utils/createPullRequestContext';
import { createMergeLockPrFromPr } from '../utils/mergeLock';
import { createCommitMessage } from './autoMergeIfPossible';
import { parseBody } from './utils/body/parseBody';

export const mergeOrEnableGithubAutoMerge = async <
  EventName extends EventsWithRepository,
>(
  pullRequest: PullRequestWithDecentData,
  context: ProbotEvent<EventName>,
  repoContext: RepoContext,
  reviewflowPrContext: ReviewflowPrContext,
  login?: string,
  skipCheckMergeableState?: boolean,
): Promise<AutoMergeRequest | null> => {
  if (pullRequest.merged_at || pullRequest.draft) return null;
  if (pullRequest.auto_merge) {
    return { enabledBy: pullRequest.auto_merge.enabled_by };
  }

  if (
    !('mergeable_state' in pullRequest) ||
    pullRequest.mergeable_state === 'unknown'
  ) {
    // GitHub is determining whether the pull request is mergeable
    await repoContext.reschedule(
      context,
      createMergeLockPrFromPr(pullRequest),
      'short',
      login,
    );
    return null;
  }

  const parsedBody = parseBody(
    reviewflowPrContext.commentBody,
    repoContext.config.prDefaultOptions,
  );
  const options = parsedBody?.options || repoContext.config.prDefaultOptions;

  const [commitHeadline, commitBody] = createCommitMessage({
    pullRequest,
    parsedBody,
    options,
  });

  if (
    !skipCheckMergeableState &&
    (pullRequest.mergeable_state === 'clean' ||
      pullRequest.mergeable_state === 'has_hooks' ||
      pullRequest.mergeable_state === 'unstable')
  ) {
    try {
      await context.octokit.pulls.merge({
        merge_method: 'squash',
        owner: pullRequest.base.repo.owner.login,
        repo: pullRequest.base.repo.name,
        pull_number: pullRequest.number,
        commit_title: commitHeadline,
        commit_message: commitBody,
      });
    } catch (err) {
      context.log.error('Could not automerge', {
        ...context.repo({
          issue_number: pullRequest.number,
        }),
        err,
      });
      context.octokit.issues.createComment(
        context.repo({
          issue_number: pullRequest.number,
          body: `${login ? `@${login} ` : ''}Could not automerge`,
        }),
      );
    }
    return null;
  }

  try {
    /* Conditions:
Allow auto-merge enabled in settings.
The pull request base must have a branch protection rule with at least one requirement enabled.
The pull request must be in a state where requirements have not yet been satisfied. If the pull request can already be merged, attempting to enable auto-merge will fail.
*/
    const response = await enableGithubAutoMergeMutation(context, {
      pullRequestId: pullRequest.node_id,
      mergeMethod: 'SQUASH',
      commitHeadline,
      commitBody,
    });
    return response.enablePullRequestAutoMerge.pullRequest.autoMergeRequest;
  } catch (err) {
    context.log.error(
      'Could not enable automerge',
      context.repo({
        issue_number: pullRequest.number,
      }),
      err,
    );
    context.octokit.issues.createComment(
      context.repo({
        issue_number: pullRequest.number,
        body: `${login ? `@${login} ` : ''}Could not enable automerge`,
      }),
    );
  }
  return null;
};

export const disableGithubAutoMerge = async <
  EventName extends EventsWithRepository,
>(
  pullRequest: PullRequestWithDecentData,
  context: ProbotEvent<EventName>,
  repoContext: RepoContext,
  reviewflowPrContext: ReviewflowPrContext,
  login?: string,
): Promise<boolean> => {
  try {
    /* Conditions:
Allow auto-merge enabled in settings.
The pull request base must have a branch protection rule with at least one requirement enabled.
The pull request must be in a state where requirements have not yet been satisfied. If the pull request can already be merged, attempting to enable auto-merge will fail.
*/
    const response = await disableGithubAutoMergeMutation(context, {
      pullRequestId: pullRequest.node_id,
    });
    return (
      response.disablePullRequestAutoMerge.pullRequest.autoMergeRequest === null
    );
  } catch (err) {
    context.log.error(
      'Could not disable automerge',
      context.repo({
        issue_number: pullRequest.number,
      }),
      err,
    );
    context.octokit.issues.createComment(
      context.repo({
        issue_number: pullRequest.number,
        body: `${login ? `@${login} ` : ''}Could not disable automerge`,
      }),
    );
    return false;
  }
};
