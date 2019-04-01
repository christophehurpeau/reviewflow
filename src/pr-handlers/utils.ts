import Webhooks from '@octokit/webhooks';
import { Context } from 'probot';
import { obtainRepoContext, RepoContext } from '../context/repoContext';

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

  repoContext.lockPR(context, async () => {
    await callback(repoContext);
  });
};

export const createHandlerPullRequestChange = <
  T extends Webhooks.WebhookPayloadPullRequest
>(
  callback: (
    context: Context<T>,
    repoContext: RepoContext,
  ) => void | Promise<void>,
) => (context: Context<T>) => {
  return handlerPullRequestChange(context, (repoContext) =>
    callback(context, repoContext),
  );
};

export type Handler<T = any> = (
  context: Context<T>,
  repoContext: RepoContext,
) => Promise<void>;
