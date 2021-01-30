import type { EventPayloads } from '@octokit/webhooks';
import type { Context } from 'probot';
import type { RepoContext } from 'context/repoContext';
import type { ReviewflowPrContext } from '../utils/createPullRequestContext';
import type { Options } from './utils/body/prOptions';
import { updateCommentOptions } from './utils/body/updateBody';

const updatePrCommentBody = async <
  E extends EventPayloads.WebhookPayloadPullRequest
>(
  context: Context<E>,
  reviewflowPrContext: ReviewflowPrContext,
  newBody: string,
): Promise<void> => {
  await context.octokit.issues.updateComment(
    context.repo({
      comment_id: reviewflowPrContext.reviewflowPr.commentId,
      body: newBody,
    }),
  );
  reviewflowPrContext.commentBody = newBody;
};

export const updatePrCommentBodyIfNeeded = async <
  E extends EventPayloads.WebhookPayloadPullRequest
>(
  context: Context<E>,
  reviewflowPrContext: ReviewflowPrContext,
  newBody: string,
): Promise<void> => {
  if (reviewflowPrContext.commentBody !== newBody) {
    await updatePrCommentBody(context, reviewflowPrContext, newBody);
  }
};

export const updatePrCommentBodyOptions = async <
  E extends EventPayloads.WebhookPayloadPullRequest
>(
  context: Context<E>,
  repoContext: RepoContext,
  reviewflowPrContext: ReviewflowPrContext,
  updateOptions: Partial<Options>,
): Promise<void> => {
  const { commentBody: newBody } = updateCommentOptions(
    context.payload.repository.html_url,
    repoContext.config.labels.list,
    reviewflowPrContext.commentBody,
    repoContext.config.prDefaultOptions,
    updateOptions,
  );

  await updatePrCommentBodyIfNeeded(context, reviewflowPrContext, newBody);
};
