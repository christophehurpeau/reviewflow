import type { EventPayloads } from '@octokit/webhooks';
import type { Context } from 'probot';
import type { OnCallback } from 'probot/lib/application';
import type { AppContext } from '../../../context/AppContext';
import type { RepoContext, LockedMergePr } from '../../../context/repoContext';
import { createRepoHandler } from '../../repository-handlers/utils/createRepoHandler';
import type {
  PullRequestData,
  PullRequestFromWebhook,
} from './PullRequestData';
import type {
  CreatePrContextOptions,
  ReviewflowPrContext,
} from './createPullRequestContext';
import { getReviewflowPrContext } from './createPullRequestContext';

export type CallbackWithPRAndRepoContext<T extends PullRequestData> = (
  pullRequest: T,
  repoContext: RepoContext,
) => void | Promise<void>;

export const createPullRequestHandler = <
  T extends
    | EventPayloads.WebhookPayloadPullRequest
    | EventPayloads.WebhookPayloadPullRequestReview
    | EventPayloads.WebhookPayloadPullRequestReviewComment
    | EventPayloads.WebhookPayloadIssueComment
    | EventPayloads.WebhookPayloadPullRequestReviewComment,
  U extends PullRequestFromWebhook
>(
  appContext: AppContext,
  getPullRequestInPayload: (
    payload: Context<T>['payload'],
    context: Context<T>,
    repoContext: RepoContext,
  ) => U | null,
  callbackPr: (
    pullRequest: U,
    context: Context<T>,
    repoContext: RepoContext,
    reviewflowPrContext: ReviewflowPrContext | null,
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
      repoContext,
    );
    if (pullRequest === null) return;
    const options = callbackBeforeLock
      ? callbackBeforeLock(pullRequest, context, repoContext)
      : {};

    await repoContext.lockPullRequest(pullRequest, async () => {
      /*
       * When repo are ignored, only slack notifications are sent.
       * PR is not linted, commented, nor auto merged.
       */
      const reviewflowPrContext = repoContext.shouldIgnore
        ? null
        : await getReviewflowPrContext(
            pullRequest.number,
            context,
            repoContext,
            options.reviewflowCommentPromise,
          );

      return callbackPr(pullRequest, context, repoContext, reviewflowPrContext);
    });
  });
};

export const createPullRequestsHandler = <
  T extends { repository: EventPayloads.PayloadRepository },
  U extends PullRequestFromWebhook | LockedMergePr
>(
  appContext: AppContext,
  getPrs: (payload: Context<T>['payload'], repoContext: RepoContext) => U[],
  callbackPr: (
    pullRequest: U,
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
