import { PullsGetResponse } from '@octokit/rest';
import Webhooks from '@octokit/webhooks';
import { Context } from 'probot';
import { obtainRepoContext, RepoContext } from '../context/repoContext';

export type PRHandler<T = any, Result = void, FourthArgument = never> = (
  pr: PullsGetResponse,
  context: Context<T>,
  repoContext: RepoContext,
  fourthArgument?: FourthArgument,
) => Promise<Result>;

export type CallbackWithPRAndRepoContext = (
  pr: PullsGetResponse,
  repoContext: RepoContext,
) => void | Promise<void>;

export const handlerPullRequestChange = async <
  T extends Webhooks.WebhookPayloadPullRequest
>(
  context: Context<T>,
  callback: CallbackWithPRAndRepoContext,
): Promise<void> => {
  const repoContext = await obtainRepoContext(context);
  if (!repoContext) return;

  repoContext.lockPROrPRS(String(context.payload.pull_request.id), async () => {
    const prResult = await context.github.pulls.get(
      context.repo({
        pull_number: context.payload.pull_request.number,
      }),
    );

    await callback(prResult.data, repoContext);
  });
};

type CallbackPRAndContextAndRepoContext<T> = (
  pr: PullsGetResponse,
  context: Context<T>,
  repoContext: RepoContext,
) => void | Promise<void>;

export const createHandlerPullRequestChange = <
  T extends Webhooks.WebhookPayloadPullRequest
>(
  callback: CallbackPRAndContextAndRepoContext<T>,
) => (context: Context<T>) => {
  return handlerPullRequestChange(context, (pr, repoContext) =>
    callback(pr, context, repoContext),
  );
};

type CallbackContextAndRepoContext<T> = (
  context: Context<T>,
  repoContext: RepoContext,
) => void | Promise<void>;

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
