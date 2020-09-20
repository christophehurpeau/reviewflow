import { Context } from 'probot';
import { PrContextWithUpdatedPr } from '../utils/createPullRequestContext';

export const updateBranch = async (
  updatedPrContext: PrContextWithUpdatedPr,
  context: Context<any>,
  login: string,
): Promise<void> => {
  const pr = updatedPrContext.updatedPr;
  context.log.info('update branch', {
    head: pr.head.ref,
    base: pr.base.ref,
  });

  const result = await context.github.repos
    .merge({
      owner: pr.head.repo.owner.login,
      repo: pr.head.repo.name,
      head: pr.base.ref,
      base: pr.head.ref,
    })
    .catch((err) => ({ error: err } as any));

  context.log.info('update branch result', {
    status: result.status,
    sha: result.data && result.data.sha,
    error: result.error,
  });

  if (result.status === 204) {
    context.github.issues.createComment(
      context.repo({
        issue_number: pr.number,
        body: `@${login} could not update branch: base already contains the head, nothing to merge.`,
      }),
    );
  } else if (result.status === 409) {
    context.github.issues.createComment(
      context.repo({
        issue_number: pr.number,
        body: `@${login} could not update branch: merge conflict. Please resolve manually.`,
      }),
    );
  } else if (!result || !result.data || !result.data.sha) {
    context.github.issues.createComment(
      context.repo({
        issue_number: pr.number,
        body: `@${login} could not update branch (unknown error)`,
      }),
    );
  } else {
    context.github.issues.createComment(
      context.repo({
        issue_number: pr.number,
        body: `@${login} branch updated: ${result.data.sha}`,
      }),
    );
  }
};
