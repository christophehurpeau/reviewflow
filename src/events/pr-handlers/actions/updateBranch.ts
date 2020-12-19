import type { Context } from 'probot';
import type { PullRequestWithDecentData } from '../utils/PullRequestData';

export const updateBranch = async (
  pullRequest: PullRequestWithDecentData,
  context: Context<any>,
  login: string,
): Promise<void> => {
  context.log.info('update branch', {
    head: pullRequest.head.ref,
    base: pullRequest.base.ref,
  });

  const result = await context.octokit.repos
    .merge({
      owner: pullRequest.head.repo.owner.login,
      repo: pullRequest.head.repo.name,
      head: pullRequest.base.ref,
      base: pullRequest.head.ref,
    })
    .catch((err) => ({ error: err } as any));

  context.log.info('update branch result', {
    status: result.status,
    sha: result.data?.sha,
    error: result.error,
  });

  if (result.status === 204) {
    context.octokit.issues.createComment(
      context.repo({
        issue_number: pullRequest.number,
        body: `@${login} could not update branch: base already contains the head, nothing to merge.`,
      }),
    );
  } else if (result.status === 409) {
    context.octokit.issues.createComment(
      context.repo({
        issue_number: pullRequest.number,
        body: `@${login} could not update branch: merge conflict. Please resolve manually.`,
      }),
    );
  } else if (!result || !result.data || !result.data.sha) {
    context.octokit.issues.createComment(
      context.repo({
        issue_number: pullRequest.number,
        body: `@${login} could not update branch (unknown error)`,
      }),
    );
  } else {
    context.octokit.issues.createComment(
      context.repo({
        issue_number: pullRequest.number,
        body: `@${login} branch updated: ${result.data.sha}`,
      }),
    );
  }
};
