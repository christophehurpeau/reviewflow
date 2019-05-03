import Webhooks from '@octokit/webhooks';
import { Context } from 'probot';
import { obtainRepoContext, RepoContext } from '../context/repoContext';

export type Handler<T = any> = (
  context: Context<T>,
  repoContext: RepoContext,
) => Promise<void>;

export type CallbackWithRepoContext = (
  repoContext: RepoContext,
) => void | Promise<void>;

export const handlerPullRequestChange = async <
  T extends Webhooks.WebhookPayloadPullRequest
>(
  context: Context<T>,
  callback: CallbackWithRepoContext,
): Promise<void> => {
  const repoContext = await obtainRepoContext(context);
  if (!repoContext) return;

  repoContext.lockPROrPRS(String(context.payload.pull_request.id), async () => {
    await callback(repoContext);
  });
};

type CallbackContextAndRepoContext<T> = (
  context: Context<T>,
  repoContext: RepoContext,
) => void | Promise<void>;

export const createHandlerPullRequestChange = <
  T extends Webhooks.WebhookPayloadPullRequest
>(
  callback: CallbackContextAndRepoContext<T>,
) => (context: Context<T>) => {
  return handlerPullRequestChange(context, (repoContext) =>
    callback(context, repoContext),
  );
};

export const createHandlerPullRequestsChange = <T>(
  getPullRequests: (
    context: Context<T>,
    repoContext: RepoContext,
  ) => { id: string | number }[],
  callback: CallbackContextAndRepoContext<T>,
) => async (context: Context<T>): Promise<void> => {
  const repoContext = await obtainRepoContext(context);
  if (!repoContext) return;

  const prs = getPullRequests(context, repoContext);
  if (prs.length === 0) return;
  return repoContext.lockPROrPRS(prs.map((pr) => String(pr.id)), () =>
    callback(context, repoContext),
  );
};
