import type { Probot } from 'probot';
import type { ProbotEvent } from 'events/probot-types';
import { catchExceptedErrors } from '../../../ExpectedError';
import type { AppContext } from '../../../context/AppContext';
import type {
  RepoContext,
  CustomExtract,
  EventsWithRepository,
} from '../../../context/repoContext';
import { obtainRepoContext } from '../../../context/repoContext';
import type { PullRequestDataMinimumData } from './PullRequestData';
import type {
  CreatePrContextOptions,
  ReviewflowPrContext,
} from './createPullRequestContext';
import { getReviewflowPrContext } from './createPullRequestContext';
import type { PullRequestFromProbotEvent } from './getPullRequestFromPayload';

export type EventsWithPullRequest = CustomExtract<
  EventsWithRepository,
  | 'pull_request.assigned'
  | 'pull_request.auto_merge_disabled'
  | 'pull_request.auto_merge_enabled'
  | 'pull_request.closed'
  | 'pull_request.converted_to_draft'
  | 'pull_request.edited'
  | 'pull_request.labeled'
  | 'pull_request.locked'
  | 'pull_request.opened'
  | 'pull_request.ready_for_review'
  | 'pull_request.reopened'
  | 'pull_request.review_request_removed'
  | 'pull_request.review_requested'
  | 'pull_request.synchronize'
  | 'pull_request.unassigned'
  | 'pull_request.unlabeled'
  | 'pull_request.unlocked'
  | 'pull_request_review.dismissed'
  | 'pull_request_review.edited'
  | 'pull_request_review.submitted'
  | 'pull_request_review_comment'
  | 'pull_request_review_comment.created'
  | 'pull_request_review_comment.deleted'
  | 'pull_request_review_comment.edited'
>;

export type EventsWithPullRequests = CustomExtract<
  EventsWithRepository,
  'check_run.completed' | 'check_suite.completed' | 'status'
>;

export type EventsWithIssue = CustomExtract<
  EventsWithRepository,
  'issue_comment.created' | 'issue_comment.deleted' | 'issue_comment.edited'
>;

export const createPullRequestHandler = <
  EventName extends EventsWithPullRequest | EventsWithIssue,
  GroupNames extends string = string,
>(
  app: Probot,
  appContext: AppContext,
  eventName: EventName | EventName[],
  getPullRequestInPayload: (
    payload: ProbotEvent<EventName>['payload'],
    context: ProbotEvent<EventName>,
    repoContext: RepoContext<GroupNames>,
  ) => PullRequestFromProbotEvent<EventName> | null,
  callbackPr: (
    pullRequest: PullRequestFromProbotEvent<EventName>,
    context: ProbotEvent<EventName>,
    repoContext: RepoContext<GroupNames>,
    reviewflowPrContext: ReviewflowPrContext | null,
  ) => void | Promise<void>,
  callbackBeforeLock?: (
    pullRequest: PullRequestFromProbotEvent<EventName>,
    context: ProbotEvent<EventName>,
    repoContext: RepoContext<GroupNames>,
  ) => CreatePrContextOptions | Promise<CreatePrContextOptions>,
): void => {
  app.on(eventName, async (context: ProbotEvent<EventName>) => {
    return catchExceptedErrors(async () => {
      const repoContext = await obtainRepoContext(appContext, context);
      const pullRequest: PullRequestFromProbotEvent<EventName> | null =
        getPullRequestInPayload(context.payload, context, repoContext);

      if (pullRequest === null) return;
      const options = callbackBeforeLock
        ? await callbackBeforeLock(pullRequest, context, repoContext)
        : {};

      await repoContext.lockPullRequest(
        `${context.name}:${context.payload.action}`,
        pullRequest,
        async () => {
          /*
           * When repo are ignored, only slack notifications are sent.
           * PR is not linted, commented, nor auto merged.
           */
          const reviewflowPrContext = repoContext.shouldIgnore
            ? null
            : await getReviewflowPrContext(
                pullRequest,
                context,
                repoContext,
                options.reviewflowCommentPromise,
              );

          return callbackPr(
            pullRequest,
            context,
            repoContext,
            reviewflowPrContext,
          );
        },
      );
    });
  });
};

export const createPullRequestsHandler = <
  EventName extends EventsWithPullRequests,
  U extends PullRequestDataMinimumData,
  GroupNames extends string,
>(
  app: Probot,
  appContext: AppContext,
  eventName: EventName,
  getPrs: (
    payload: ProbotEvent<EventName>['payload'],
    repoContext: RepoContext<GroupNames>,
  ) => U[] | Promise<U[]>,
  callbackPr: (
    pullRequest: U,
    context: ProbotEvent<EventName>,
    repoContext: RepoContext<GroupNames>,
  ) => void | Promise<void>,
): void => {
  app.on(eventName, (context) => {
    return catchExceptedErrors(async () => {
      const repoContext = await obtainRepoContext<EventName>(
        appContext,
        context,
      );
      const prs = await getPrs(context.payload, repoContext);
      if (prs.length === 0) return;

      await Promise.all(
        prs.map((pr) =>
          repoContext.lockPullRequest(
            `${context.name}:${(context.payload as any).action}`,
            pr,
            async () => {
              return callbackPr(pr, context, repoContext);
            },
          ),
        ),
      );
    });
  });
};
