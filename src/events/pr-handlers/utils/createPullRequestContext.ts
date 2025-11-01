import type { MongoInsertType } from "liwi-mongo";
import type {
  EventsWithRepository,
  RepoContext,
} from "../../../context/repoContext.ts";
import type { ReviewflowPr } from "../../../mongo.ts";
import { ExcludesFalsy } from "../../../utils/Excludes.ts";
import { getReviewsState } from "../../../utils/github/pullRequest/reviews.ts";
import type { ProbotEvent } from "../../probot-types.ts";
import { defaultCommentBody } from "../actions/utils/body/updateBody.ts";
import type {
  PullRequestDataMinimumData,
  PullRequestWithDecentData,
} from "./PullRequestData.ts";
import { toBasicUser } from "./PullRequestData.ts";
import { fetchPr } from "./fetchPr.ts";
import {
  createEmptyReviews,
  groupReviewsState,
} from "./groupReviewsWithState.ts";
import {
  createReviewflowComment,
  findReviewflowComment,
  getReviewflowCommentById,
} from "./reviewflowComment.ts";

export interface CreatePrContextOptions {
  reviewflowCommentPromise?: ReturnType<typeof createReviewflowComment>;
}

export interface ReviewflowPrContext {
  reviewflowPr: ReviewflowPr;
  commentBody: string;
}

export const getReviewflowPrContext = async <T extends EventsWithRepository>(
  pullRequest: PullRequestDataMinimumData | PullRequestWithDecentData,
  context: ProbotEvent<T>,
  repoContext: RepoContext,
  reviewflowCommentPromise?: ReturnType<typeof createReviewflowComment>,
): Promise<ReviewflowPrContext> => {
  const appContext = repoContext.appContext;
  const prEmbed = {
    id: pullRequest.id,
    number: pullRequest.number,
  };

  if (reviewflowCommentPromise) {
    const comment = await reviewflowCommentPromise;
    const reviewflowPr = await appContext.mongoStores.prs.insertOne({
      account: repoContext.accountEmbed,
      repo: repoContext.repoEmbed,
      pr: prEmbed,
      commentId: comment.id,
      title: "title" in pullRequest ? pullRequest.title : "Unknown Title",
      isClosed: "closed_at" in pullRequest ? !!pullRequest.closed_at : false,
      isDraft: "draft" in pullRequest && pullRequest.draft === true,
      reviews: createEmptyReviews(),
      assignees:
        "assignees" in pullRequest && pullRequest.assignees
          ? pullRequest.assignees.filter(ExcludesFalsy).map(toBasicUser)
          : [],
      flowDates:
        "created_at" in pullRequest
          ? {
              createdAt: new Date(pullRequest.created_at),
              openedAt: new Date(pullRequest.created_at),
              readyAt: pullRequest.draft
                ? undefined
                : new Date(pullRequest.created_at),
              closedAt: pullRequest.closed_at
                ? new Date(pullRequest.closed_at)
                : undefined,
            }
          : undefined,
    });
    return { reviewflowPr, commentBody: comment.body! };
  }

  const existing = await appContext.mongoStores.prs.findOne({
    "account.id": repoContext.accountEmbed.id,
    "repo.id": repoContext.repoEmbed.id,
    "pr.number": prEmbed.number,
  });

  const [comment, reviewsState] = existing
    ? await Promise.all([
        getReviewflowCommentById(
          pullRequest.number,
          context,
          existing.commentId,
        ),
      ])
    : await Promise.all([
        findReviewflowComment(pullRequest.number, context),
        getReviewsState(
          context,
          "assignees" in pullRequest
            ? pullRequest
            : await fetchPr(context, pullRequest.number),
        ),
      ]);

  const createReviewflowPr = (
    commentId: number,
  ): MongoInsertType<ReviewflowPr> => ({
    account: repoContext.accountEmbed,
    repo: repoContext.repoEmbed,
    pr: prEmbed,
    title: "title" in pullRequest ? pullRequest.title : "Unknown Title",
    isClosed: "closed_at" in pullRequest ? !!pullRequest.closed_at : false,
    isDraft: "draft" in pullRequest && pullRequest.draft === true,
    changesInformation:
      "changed_files" in pullRequest
        ? {
            changedFiles: pullRequest.changed_files!,
            additions: pullRequest.additions!,
            deletions: pullRequest.deletions!,
          }
        : undefined,
    commentId,
    reviews: groupReviewsState(reviewsState!),
    assignees:
      "assignees" in pullRequest && pullRequest.assignees
        ? pullRequest.assignees.filter(ExcludesFalsy).map(toBasicUser)
        : [],
  });

  if (!comment) {
    const newComment = await createReviewflowComment(
      pullRequest.number,
      context,
      defaultCommentBody,
    );

    if (!existing) {
      const reviewflowPr = await appContext.mongoStores.prs.insertOne(
        createReviewflowPr(newComment.id),
      );
      return { reviewflowPr, commentBody: newComment.body! };
    } else {
      await appContext.mongoStores.prs.partialUpdateByKey(existing._id, {
        $set: { commentId: newComment.id },
      });
      return { reviewflowPr: existing, commentBody: newComment.body! };
    }
  } else if (!existing) {
    const reviewflowPr = await appContext.mongoStores.prs.insertOne(
      createReviewflowPr(comment.id),
    );
    return { reviewflowPr, commentBody: comment.body! };
  }

  return { reviewflowPr: existing, commentBody: comment.body! };
};
