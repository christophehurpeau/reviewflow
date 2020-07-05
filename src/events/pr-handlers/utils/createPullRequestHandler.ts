import { Context } from 'probot';
import Webhooks from '@octokit/webhooks';
import { OnCallback } from 'probot/lib/application';
import { createRepoHandler } from '../../repository-handlers/utils/createRepoHandler';
import { AppContext } from '../../../context/AppContext';
import { RepoContext, LockedMergePr } from '../../../context/repoContext';
import {
  createPullRequestContextFromWebhook,
  CreatePrContextOptions,
  PrContext,
} from './createPullRequestContext';
import { PullRequestData, PullRequestFromWebhook } from './PullRequestData';

export type CallbackWithPRAndRepoContext<T extends PullRequestData> = (
  prContext: PrContext<T>,
  repoContext: RepoContext,
) => void | Promise<void>;

export const createPullRequestHandler = <
  T extends { repository: Webhooks.PayloadRepository },
  U extends PullRequestFromWebhook
>(
  appContext: AppContext,
  getPullRequestInPayload: (
    payload: Context<T>['payload'],
    context: Context<T>,
  ) => U | null,
  callbackPr: (
    prContext: PrContext<U>,
    context: Context<T>,
    repoContext: RepoContext,
  ) => void | Promise<void>,
  callbackBeforeLock?: (
    pullRequest: U,
    context: Context<T>,
    repoContext: RepoContext,
  ) => CreatePrContextOptions,
): OnCallback<T> => {
  return createRepoHandler(appContext, async (context, repoContext) => {
    const pullRequest: U | null = getPullRequestInPayload(
      context.payload,
      context,
    );
    if (pullRequest === null) return;
    const options = callbackBeforeLock
      ? callbackBeforeLock(pullRequest, context, repoContext)
      : {};

    await repoContext.lockPR(
      String(pullRequest.id),
      pullRequest.number,
      async () => {
        const prContext = await createPullRequestContextFromWebhook<T, U>(
          appContext,
          repoContext,
          context,
          pullRequest,
          options,
        );

        return callbackPr(prContext, context, repoContext);
      },
    );
  });
};

export const createPullRequestsHandler = <
  T extends { repository: Webhooks.PayloadRepository },
  U extends PullRequestFromWebhook | LockedMergePr
>(
  appContext: AppContext,
  getPrs: (payload: Context<T>['payload'], repoContext: RepoContext) => U[],
  callbackPr: (
    pr: U,
    context: Context<T>,
    repoContext: RepoContext,
  ) => void | Promise<void>,
): OnCallback<T> => {
  return createRepoHandler(appContext, async (context, repoContext) => {
    const prs = getPrs(context.payload, repoContext);
    if (prs.length === 0) return;

    await Promise.all(
      prs.map((pr) =>
        repoContext.lockPR(String(pr.id), pr.number, async () => {
          return callbackPr(pr, context, repoContext);
        }),
      ),
    );
  });
};
