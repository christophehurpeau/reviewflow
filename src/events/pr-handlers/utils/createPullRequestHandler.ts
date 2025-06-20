import type { Probot } from "probot";
import { catchExceptedErrors } from "../../../ExpectedError.ts";
import type { AppContext } from "../../../context/AppContext.ts";
import type {
  CustomExtract,
  EventsWithRepository,
  RepoContext,
} from "../../../context/repoContext.ts";
import { obtainRepoContext } from "../../../context/repoContext.ts";
import type { ProbotEvent } from "../../probot-types.ts";
import type { PullRequestDataMinimumData } from "./PullRequestData";
import type {
  CreatePrContextOptions,
  ReviewflowPrContext,
} from "./createPullRequestContext.ts";
import { getReviewflowPrContext } from "./createPullRequestContext.ts";
import type { PullRequestFromProbotEvent } from "./getPullRequestFromPayload.ts";

export type EventsWithPullRequest = CustomExtract<
  EventsWithRepository,
  | "pull_request_review_comment.created"
  | "pull_request_review_comment.deleted"
  | "pull_request_review_comment.edited"
  | "pull_request_review_comment"
  | "pull_request_review.dismissed"
  | "pull_request_review.edited"
  | "pull_request_review.submitted"
  | "pull_request.assigned"
  | "pull_request.auto_merge_disabled"
  | "pull_request.auto_merge_enabled"
  | "pull_request.closed"
  | "pull_request.converted_to_draft"
  | "pull_request.edited"
  | "pull_request.labeled"
  | "pull_request.locked"
  | "pull_request.opened"
  | "pull_request.ready_for_review"
  | "pull_request.reopened"
  | "pull_request.review_request_removed"
  | "pull_request.review_requested"
  | "pull_request.synchronize"
  | "pull_request.unassigned"
  | "pull_request.unlabeled"
  | "pull_request.unlocked"
>;

export type EventsWithPullRequests = CustomExtract<
  EventsWithRepository,
  | "check_run.completed"
  | "check_run.created"
  | "check_suite.completed"
  | "push"
  | "status"
  | "workflow_run.completed"
  | "workflow_run.requested"
  // | 'workflow_run.in_progress'
>;

export type EventsWithIssue = CustomExtract<
  EventsWithRepository,
  "issue_comment.created" | "issue_comment.deleted" | "issue_comment.edited"
>;

export const createPullRequestHandler = <
  TeamNames extends string,
  EventName extends EventsWithIssue | EventsWithPullRequest,
>(
  app: Probot,
  appContext: AppContext,
  eventName: EventName | EventName[],
  getPullRequestInPayload: (
    payload: ProbotEvent<EventName>["payload"],
    context: ProbotEvent<EventName>,
    repoContext: RepoContext<TeamNames>,
  ) => PullRequestFromProbotEvent<EventName> | null,
  callbackPr: (
    pullRequest: PullRequestFromProbotEvent<EventName>,
    context: ProbotEvent<EventName>,
    repoContext: RepoContext<TeamNames>,
    reviewflowPrContext: ReviewflowPrContext | null,
  ) => Promise<void> | void,
  callbackBeforeLock?: (
    pullRequest: PullRequestFromProbotEvent<EventName>,
    context: ProbotEvent<EventName>,
    repoContext: RepoContext<TeamNames>,
  ) => CreatePrContextOptions | Promise<CreatePrContextOptions>,
): void => {
  app.on(eventName, async (context: ProbotEvent<EventName>) => {
    return catchExceptedErrors(async () => {
      const repoContext = await obtainRepoContext(appContext, context);
      const pullRequest: PullRequestFromProbotEvent<EventName> | null =
        getPullRequestInPayload(context.payload, context, repoContext);

      if (pullRequest === null) return;
      let res = callbackBeforeLock
        ? callbackBeforeLock(pullRequest, context, repoContext)
        : {};

      if (res && typeof (res as Promise<any>).then === "function") {
        // avoid calling await if not necessary, for opened event we need to keep it synchronous
        res = await res;
      }
      const options: CreatePrContextOptions = res as CreatePrContextOptions;

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
  TeamNames extends string,
>(
  app: Probot,
  appContext: AppContext,
  eventName: EventName | EventName[],
  getPrs: (
    payload: ProbotEvent<EventName>["payload"],
    repoContext: RepoContext<TeamNames>,
    context: ProbotEvent<EventName>,
  ) => Promise<U[]> | U[],
  callbackPr: (
    pullRequest: U,
    context: ProbotEvent<EventName>,
    repoContext: RepoContext<TeamNames>,
    reviewflowPrContext: ReviewflowPrContext | null,
  ) => Promise<void> | void,
): void => {
  app.on(eventName, (context) => {
    return catchExceptedErrors(async () => {
      const repoContext = await obtainRepoContext<EventName>(
        appContext,
        context,
      );
      const prs = await getPrs(context.payload, repoContext, context);
      if (prs.length === 0) return;

      await Promise.all(
        prs.map((pr) =>
          repoContext.lockPullRequest(
            `${context.name}:${(context.payload as any).action}`,
            pr,
            async () => {
              const reviewflowPrContext = repoContext.shouldIgnore
                ? null
                : await getReviewflowPrContext(pr, context, repoContext);

              return callbackPr(pr, context, repoContext, reviewflowPrContext);
            },
          ),
        ),
      );
    });
  });
};
