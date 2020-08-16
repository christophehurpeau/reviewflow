import { Context, Octokit } from 'probot';
import { AppContext } from 'context/AppContext';
import { ReviewflowPr } from 'mongo';
import { RepoContext } from 'context/repoContext';
import { defaultCommentBody } from '../actions/utils/body/updateBody';
import { fetchPr } from './fetchPr';
import { PullRequestData, PullRequestFromWebhook } from './PullRequestData';
import {
  createReviewflowComment,
  getReviewflowCommentById,
} from './reviewflowComment';

export interface PrContext<T extends PullRequestData = PullRequestData> {
  appContext: AppContext;
  repoContext: RepoContext;
  pr: T;
  updatedPr: null | Octokit.PullsGetResponse;
  reviewflowPr: ReviewflowPr;
  commentBody: string;
}

export interface PrContextWithUpdatedPr<
  T extends PullRequestData = PullRequestData
> extends PrContext<T> {
  updatedPr: Octokit.PullsGetResponse;
}

export interface CreatePrContextOptions {
  reviewflowCommentPromise?: ReturnType<typeof createReviewflowComment>;
}

const getReviewflowPr = async <T, U extends PullRequestData>(
  appContext: AppContext,
  repoContext: RepoContext,
  context: Context<T>,
  pr: U,
  reviewflowCommentPromise?: ReturnType<typeof createReviewflowComment>,
): Promise<{ reviewflowPr: ReviewflowPr; commentBody: string }> => {
  const prEmbed = { number: pr.number };

  if (reviewflowCommentPromise) {
    const comment = await reviewflowCommentPromise;
    const reviewflowPr = await appContext.mongoStores.prs.insertOne({
      account: repoContext.accountEmbed,
      repo: repoContext.repoEmbed,
      pr: prEmbed,
      commentId: comment.id,
    });
    return { reviewflowPr, commentBody: comment.body };
  }

  const existing = await appContext.mongoStores.prs.findOne({
    'account.id': repoContext.accountEmbed.id,
    'repo.id': repoContext.repoEmbed.id,
    'pr.number': pr.number,
  });
  const comment =
    existing &&
    (await getReviewflowCommentById(context, pr, existing.commentId));

  if (!comment || !existing) {
    const comment = await createReviewflowComment(
      context,
      pr,
      defaultCommentBody,
    );

    if (!existing) {
      const reviewflowPr = await appContext.mongoStores.prs.insertOne({
        account: repoContext.accountEmbed,
        repo: repoContext.repoEmbed,
        pr: prEmbed,
        commentId: comment.id,
      });
      return { reviewflowPr, commentBody: comment.body };
    } else {
      await appContext.mongoStores.prs.partialUpdateByKey(existing._id, {
        $set: { commentId: comment.id },
      });
    }
  }

  return { reviewflowPr: existing, commentBody: comment!.body };
};

export const createPullRequestContextFromWebhook = async <
  T,
  U extends PullRequestFromWebhook
>(
  appContext: AppContext,
  repoContext: RepoContext,
  context: Context<T>,
  pr: U,
  options: CreatePrContextOptions,
): Promise<PrContext<U>> => {
  if (repoContext.shouldIgnore) {
    return {
      appContext,
      repoContext,
      pr,
      reviewflowPr: null as any, // TODO fix typings to allow null
      commentBody: '',
      updatedPr: null,
    };
  }
  const { reviewflowPr, commentBody } = await getReviewflowPr(
    appContext,
    repoContext,
    context,
    pr,
    options.reviewflowCommentPromise,
  );

  return {
    appContext,
    repoContext,
    pr,
    reviewflowPr,
    commentBody,
    updatedPr: null,
  };
};

export const createPullRequestContextFromPullResponse = async <T>(
  appContext: AppContext,
  repoContext: RepoContext,
  context: Context<T>,
  pr: Octokit.PullsGetResponse,
  options: CreatePrContextOptions,
): Promise<PrContextWithUpdatedPr<Octokit.PullsGetResponse>> => {
  console.log('createPullRequestContextFromPullResponse', pr.number);
  const { reviewflowPr, commentBody } = await getReviewflowPr(
    appContext,
    repoContext,
    context,
    pr,
    options.reviewflowCommentPromise,
  );

  return {
    appContext,
    repoContext,
    pr,
    reviewflowPr,
    commentBody,
    updatedPr: pr,
  };
};

export const fetchPullRequestAndCreateContext = async <
  T,
  U extends PullRequestFromWebhook
>(
  context: Context<T>,
  prContext: PrContext<U>,
): Promise<PrContextWithUpdatedPr<U>> => {
  const updatedPr = await fetchPr(context, prContext.pr.number);
  return {
    ...prContext,
    updatedPr,
  };
};
