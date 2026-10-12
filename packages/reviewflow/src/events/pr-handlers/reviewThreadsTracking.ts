import type { Probot } from "probot";
import type { UnresolvedReviewThread } from "reviewflow-core";
import type { AppContext } from "../../context/AppContext.ts";
import type { RepoContext } from "../../context/repoContext.ts";
import { fetchUnresolvedReviewThreads } from "../../utils/github/pullRequest/fetchUnresolvedReviewThreads.ts";
import type { ProbotEvent } from "../probot-types.ts";
import { tryToAutomerge } from "./actions/tryToAutomerge.ts";
import { updateStatusCheckFromStepsState } from "./actions/updateStatusCheckFromStepsState.ts";
import hasLabelInPR from "./actions/utils/labels/hasLabelInPR.ts";
import {
  findSlackSentMessages,
  markAsDoneSlackSentMessages,
  unmarkAsDoneSlackSentMessages,
} from "./actions/utils/slackUtils.ts";
import { calcStepsState } from "./actions/utils/steps/calcStepsState.ts";
import { createPullRequestHandler } from "./utils/createPullRequestHandler.ts";
import { fetchPr } from "./utils/fetchPr.ts";

type ReviewThreadsEventName =
  | "pull_request_review_comment.created"
  | "pull_request_review_comment.deleted"
  | "pull_request_review_thread.resolved"
  | "pull_request_review_thread.unresolved";

interface ThreadComment {
  id: number;
  html_url: string;
  path: string;
  user: { login: string } | null;
  in_reply_to_id?: number;
  pull_request_review_id: number | null;
}

type ThreadEventPayload = ProbotEvent<
  | "pull_request_review_thread.resolved"
  | "pull_request_review_thread.unresolved"
>["payload"];

/**
 * What an event says about the open threads: a thread to add or remove, or
 * `seed` when the payload is not enough to update the stored list.
 */
export type ReviewThreadsChange =
  | { type: "add"; thread: UnresolvedReviewThread }
  | { type: "none" }
  | { type: "remove"; rootCommentId: number }
  | { type: "seed" };

const toUnresolvedThread = (
  comment: ThreadComment,
): UnresolvedReviewThread => ({
  rootCommentId: comment.id,
  url: comment.html_url,
  path: comment.path,
  authorLogin: comment.user?.login ?? null,
  reviewId: comment.pull_request_review_id ?? null,
});

const findRootComment = (
  comments: ThreadComment[],
): ThreadComment | undefined =>
  comments.find((comment) => !comment.in_reply_to_id);

export const getReviewThreadsChange = (
  payload: ProbotEvent<ReviewThreadsEventName>["payload"],
): ReviewThreadsChange => {
  if ("thread" in payload) {
    const root = findRootComment(payload.thread.comments as ThreadComment[]);
    if (!root) return { type: "seed" };
    return payload.action === "resolved"
      ? { type: "remove", rootCommentId: root.id }
      : { type: "add", thread: toUnresolvedThread(root) };
  }

  if (payload.action === "deleted") return { type: "seed" };

  const comment = payload.comment as ThreadComment;
  return comment.in_reply_to_id
    ? { type: "none" }
    : { type: "add", thread: toUnresolvedThread(comment) };
};

/**
 * `null` when the stored list stays as it is; `seed` reads it again, which is
 * all an unread list (`current` absent) can do.
 */
export const applyReviewThreadsChange = async (
  current: UnresolvedReviewThread[] | undefined,
  change: ReviewThreadsChange,
  seed: () => Promise<UnresolvedReviewThread[]>,
): Promise<UnresolvedReviewThread[] | null> => {
  if (change.type === "none") return null;
  if (change.type === "seed" || !current) return seed();

  if (change.type === "add") {
    const { thread } = change;
    return current.some((t) => t.rootCommentId === thread.rootCommentId)
      ? null
      : [...current, thread];
  }

  const next = current.filter((t) => t.rootCommentId !== change.rootCommentId);
  return next.length === current.length ? null : next;
};

const updateThreadCommentsSlackMessages = async (
  appContext: AppContext,
  repoContext: RepoContext,
  payload: ThreadEventPayload,
): Promise<void> => {
  const updateSlackSentMessages =
    payload.action === "resolved"
      ? markAsDoneSlackSentMessages
      : unmarkAsDoneSlackSentMessages;
  await Promise.all(
    payload.thread.comments.map((comment) =>
      updateSlackSentMessages(appContext, repoContext, {
        type: "review-comment",
        typeId: comment.id,
      }),
    ),
  );
};

/**
 * Strikes the review message once none of the review's threads is open. Only
 * for a "commented" review: an approval or a change request keeps its meaning
 * after its threads are resolved.
 */
const updateReviewSlackMessage = async (
  context: ProbotEvent<ReviewThreadsEventName>,
  appContext: AppContext,
  repoContext: RepoContext,
  payload: ThreadEventPayload,
  openThreads: UnresolvedReviewThread[],
): Promise<void> => {
  const root = findRootComment(payload.thread.comments as ThreadComment[]);
  const reviewId = root?.pull_request_review_id;
  if (!reviewId) return;
  const options = { type: "review-submitted", typeId: reviewId } as const;

  if (payload.action === "unresolved") {
    await unmarkAsDoneSlackSentMessages(appContext, repoContext, options);
    return;
  }

  if (openThreads.some((thread) => thread.reviewId === reviewId)) return;
  const sentMessages = await findSlackSentMessages(
    appContext,
    repoContext,
    options,
    true,
  );
  if (sentMessages.length === 0) return;

  const { data: review } = await context.octokit.rest.pulls.getReview(
    context.pullRequest({ review_id: reviewId }),
  );
  if (review.state !== "COMMENTED") return;
  await markAsDoneSlackSentMessages(appContext, repoContext, options);
};

/**
 * Keeps `unresolvedThreads` up to date. Separate from `commentCreated`, which
 * ignores this bot's comments: a thread opened by any account blocks a merge
 * when conversation resolution is required.
 */
export default function reviewThreadsTracking(
  app: Probot,
  appContext: AppContext,
): void {
  createPullRequestHandler<string, ReviewThreadsEventName>(
    app,
    appContext,
    [
      "pull_request_review_thread.resolved",
      "pull_request_review_thread.unresolved",
      "pull_request_review_comment.created",
      "pull_request_review_comment.deleted",
    ],
    (payload) => payload.pull_request,
    async (
      pullRequest,
      context,
      repoContext,
      reviewflowPrContext,
    ): Promise<void> => {
      const threadPayload =
        repoContext.slack && "thread" in context.payload
          ? context.payload
          : null;
      if (threadPayload) {
        await updateThreadCommentsSlackMessages(
          appContext,
          repoContext,
          threadPayload,
        );
      }

      if (!reviewflowPrContext) return;

      const nextThreads = await applyReviewThreadsChange(
        reviewflowPrContext.reviewflowPr.unresolvedThreads,
        getReviewThreadsChange(context.payload),
        () =>
          fetchUnresolvedReviewThreads(context.octokit, {
            ...context.repo(),
            number: pullRequest.number,
          }),
      );
      if (nextThreads) {
        await appContext.mongoStores.prs.partialUpdateOne(
          reviewflowPrContext.reviewflowPr,
          { $set: { unresolvedThreads: nextThreads } },
        );
        reviewflowPrContext.reviewflowPr.unresolvedThreads = nextThreads;
      }

      const openThreads = reviewflowPrContext.reviewflowPr.unresolvedThreads;
      if (threadPayload && openThreads) {
        await updateReviewSlackMessage(
          context,
          appContext,
          repoContext,
          threadPayload,
          openThreads,
        );
      }

      if (!nextThreads) return;

      const requiresConversationResolution =
        !!repoContext.settings.defaultBranchProtectionRules
          ?.requiresConversationResolution;
      if (
        !requiresConversationResolution ||
        repoContext.shouldIgnore ||
        pullRequest.state !== "open"
      ) {
        return;
      }

      const stepsState = calcStepsState({
        pullRequest,
        repoContext,
        reviewflowPrContext,
      });
      await updateStatusCheckFromStepsState(
        stepsState,
        pullRequest,
        context,
        repoContext,
        appContext,
        reviewflowPrContext,
      );

      const hasResolvedLastThread =
        context.payload.action === "resolved" && nextThreads.length === 0;
      if (
        hasResolvedLastThread &&
        hasLabelInPR(pullRequest.labels, repoContext.labels["merge/automerge"])
      ) {
        const restPullRequest = await fetchPr(context, pullRequest.number);
        await tryToAutomerge({
          pullRequest: restPullRequest,
          context,
          repoContext,
          reviewflowPrContext,
        });
      }
    },
  );
}
