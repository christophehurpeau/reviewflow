import type { EventsWithRepository, RepoContext } from 'context/repoContext';
import type { ProbotEvent } from 'events/probot-types';
import type { ReviewflowPr } from 'mongo';
import { defaultCommentBody } from '../actions/utils/body/updateBody';
import type { PullRequestWithDecentDataFromWebhook } from './PullRequestData';
import {
  createReviewflowComment,
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
  pullRequestNumber: PullRequestWithDecentDataFromWebhook['number'],
  context: ProbotEvent<T>,
  repoContext: RepoContext,
  reviewflowCommentPromise?: ReturnType<typeof createReviewflowComment>,
): Promise<ReviewflowPrContext> => {
  const appContext = repoContext.appContext;
  const prEmbed = { number: pullRequestNumber };

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
    'pr.number': pullRequestNumber,
  });
  const comment =
    existing &&
    (await getReviewflowCommentById(
      pullRequestNumber,
      context,
      existing.commentId,
    ));

  if (!comment || !existing) {
    const newComment = await createReviewflowComment(
      pullRequestNumber,
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
  }

  return { reviewflowPr: existing, commentBody: comment!.body! };
};
