import { Context, Octokit } from 'probot';
import { MongoStores } from '../../mongo';
import { obtainRepoContext, RepoContext } from '../../context/repoContext';

export type PRHandler<T = any, Result = void, FourthArgument = never> = (
  pr: Octokit.PullsGetResponse,
  context: Context<T>,
  repoContext: RepoContext,
  fourthArgument?: FourthArgument,
) => Promise<Result>;

export type CallbackWithPRAndRepoContext = (
  pr: Octokit.PullsGetResponse,
  repoContext: RepoContext,
) => void | Promise<void>;

export const handlerPullRequestChange = async <
  T extends { pull_request: { id: number; number: number } }
>(
  mongoStores: MongoStores,
  context: Context<T>,
  callback: CallbackWithPRAndRepoContext,
): Promise<void> => {
  let pullRequest = context.payload.pull_request;
  if (!pullRequest) {
    const issue = (context.payload as any).issue;
    if (!issue) return;
    pullRequest = {
      ...issue,
      ...issue.pull_request,
    };
  }
  if (!pullRequest) return;

  const repoContext = await obtainRepoContext(mongoStores, context);
  if (!repoContext) return;

  return repoContext.lockPROrPRS(
    String(pullRequest.id),
    pullRequest.number,
    async () => {
      const prResult = await context.github.pulls.get(
        context.repo({
          pull_number: pullRequest.number,
        }),
      );

      await callback(prResult.data, repoContext);
    },
  );
};

type CallbackPRAndContextAndRepoContext<T> = (
  pr: Octokit.PullsGetResponse,
  context: Context<T>,
  repoContext: RepoContext,
) => void | Promise<void>;

export const createHandlerPullRequestChange = <
  T extends { pull_request: { id: number; number: number } }
>(
  mongoStores: MongoStores,
  callback: CallbackPRAndContextAndRepoContext<T>,
) => (context: Context<T>) => {
  return handlerPullRequestChange(mongoStores, context, (pr, repoContext) =>
    callback(pr, context, repoContext),
  );
};

type CallbackContextAndRepoContext<T> = (
  context: Context<T>,
  repoContext: RepoContext,
) => void | Promise<void>;

export const createHandlerPullRequestsChange = <T>(
  mongoStores: MongoStores,
  getPullRequests: (
    context: Context<T>,
    repoContext: RepoContext,
  ) => { id: string | number; number: number }[],
  callback: CallbackContextAndRepoContext<T>,
) => async (context: Context<T>): Promise<void> => {
  const repoContext = await obtainRepoContext(mongoStores, context);
  if (!repoContext) return;

  const prs = getPullRequests(context, repoContext);
  if (prs.length === 0) return;
  return repoContext.lockPROrPRS(
    prs.map((pr) => String(pr.id)),
    prs.map((pr) => pr.number),
    () => callback(context, repoContext),
  );
};
