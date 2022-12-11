import type { EventsWithRepository, RepoContext } from 'context/repoContext';
import type { ProbotEvent } from 'events/probot-types';
import type { ReviewflowPr } from 'mongo';
import { defaultCommentBody } from '../actions/utils/body/updateBody';
import type { PullRequestDataMinimumData } from './PullRequestData';
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
  pullRequest: PullRequestDataMinimumData,
  context: ProbotEvent<T>,
  repoContext: RepoContext,
  reviewflowCommentPromise?: ReturnType<typeof createReviewflowComment>,
): Promise<ReviewflowPrContext> => {
  const appContext = repoContext.appContext;
  const prEmbed = { id: pullRequest.id, number: pullRequest.number };

  if (reviewflowCommentPromise) {
    const comment = await reviewflowCommentPromise;
    const reviewflowPr = await appContext.mongoStores.prs.insertOne({
      account: repoContext.accountEmbed,
      repo: repoContext.repoEmbed,
      pr: prEmbed,
      commentId: comment.id,
    });
    return { reviewflowPr, commentBody: comment.body! };
  }

  const existing = await appContext.mongoStores.prs.findOne({
    'account.id': repoContext.accountEmbed.id,
    'repo.id': repoContext.repoEmbed.id,
    'pr.number': prEmbed.number,
  });
  const comment = existing
    ? await getReviewflowCommentById(
        pullRequest.number,
        context,
        existing.commentId,
      )
    : await findReviewflowComment(pullRequest.number, context);

  if (!comment) {
    const newComment = await createReviewflowComment(
      pullRequest.number,
      context,
      defaultCommentBody,
    );

    if (!existing) {
      const reviewflowPr = await appContext.mongoStores.prs.insertOne({
        account: repoContext.accountEmbed,
        repo: repoContext.repoEmbed,
        pr: prEmbed,
        commentId: newComment.id,
      });
      return { reviewflowPr, commentBody: newComment.body! };
    } else {
      await appContext.mongoStores.prs.partialUpdateByKey(existing._id, {
        $set: { commentId: newComment.id },
      });
    }
  } else if (!existing) {
    const reviewflowPr = await appContext.mongoStores.prs.insertOne({
      account: repoContext.accountEmbed,
      repo: repoContext.repoEmbed,
      pr: prEmbed,
      commentId: comment.id,
    });
    return { reviewflowPr, commentBody: comment.body! };
  }

  return { reviewflowPr: existing, commentBody: comment!.body! };
};
