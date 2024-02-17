import type { MongoInsertType } from 'liwi-mongo';
import type {
  EventsWithRepository,
  RepoContext,
} from '../../../context/repoContext';
import type { ReviewflowPr } from '../../../mongo';
import { getReviewersWithState } from '../../../utils/github/pullRequest/reviews';
import type { ProbotEvent } from '../../probot-types';
import { defaultCommentBody } from '../actions/utils/body/updateBody';
import type {
  PullRequestDataMinimumData,
  PullRequestWithDecentData,
} from './PullRequestData';
import { toBasicUser } from './PullRequestData';
import { fetchPr } from './fetchPr';
import {
  createEmptyReviews,
  groupReviewsWithState,
} from './groupReviewsWithState';
import {
  createReviewflowComment,
  findReviewflowComment,
  getReviewflowCommentById,
} from './reviewflowComment';

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
      title: 'title' in pullRequest ? pullRequest.title : 'Unknown Title',
      isClosed: 'closed_at' in pullRequest ? !!pullRequest.closed_at : false,
      isDraft: 'draft' in pullRequest && pullRequest.draft === true,
      reviews: createEmptyReviews(),
      assignees:
        'assignees' in pullRequest && pullRequest.assignees
          ? pullRequest.assignees.map(toBasicUser)
          : [],
      flowDates:
        'created_at' in pullRequest
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
    'account.id': repoContext.accountEmbed.id,
    'repo.id': repoContext.repoEmbed.id,
    'pr.number': prEmbed.number,
  });

  const [comment, reviewersWithState] = existing
    ? await Promise.all([
        getReviewflowCommentById(
          pullRequest.number,
          context,
          existing.commentId,
        ),
      ])
    : await Promise.all([
        findReviewflowComment(pullRequest.number, context),
        getReviewersWithState(
          context,
          'assignees' in pullRequest
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
    title: 'title' in pullRequest ? pullRequest.title : 'Unknown Title',
    isClosed: 'closed_at' in pullRequest ? !!pullRequest.closed_at : false,
    isDraft: 'draft' in pullRequest && pullRequest.draft === true,
    changesInformation:
      'changed_files' in pullRequest
        ? {
            changedFiles: pullRequest.changed_files,
            additions: pullRequest.additions,
            deletions: pullRequest.deletions,
          }
        : undefined,
    commentId,
    reviews: groupReviewsWithState(reviewersWithState!),
    assignees:
      'assignees' in pullRequest && pullRequest.assignees
        ? pullRequest.assignees.map(toBasicUser)
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
