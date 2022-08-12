import type { EventsWithRepository, RepoContext } from 'context/repoContext';
import type { ProbotEvent } from 'events/probot-types';
import type { ReviewflowPrContext } from '../utils/createPullRequestContext';
import type { Options } from './utils/body/prOptions';
import { parseRepositoryOptions } from './utils/body/repositoryOptions';
import { updateCommentOptions } from './utils/body/updateBody';

const updatePrCommentBody = async <Name extends EventsWithRepository>(
  context: ProbotEvent<Name>,
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
  Name extends EventsWithRepository,
>(
  context: ProbotEvent<Name>,
  reviewflowPrContext: ReviewflowPrContext,
  newBody: string,
): Promise<void> => {
  if (reviewflowPrContext.commentBody !== newBody) {
    await updatePrCommentBody(context, reviewflowPrContext, newBody);
  }
};

export const updatePrCommentBodyOptions = async <
  Name extends EventsWithRepository,
>(
  context: ProbotEvent<Name>,
  repoContext: RepoContext,
  reviewflowPrContext: ReviewflowPrContext,
  updateOptions: Partial<Options>,
): Promise<void> => {
  const { commentBody: newBody } = updateCommentOptions(
    parseRepositoryOptions(context.payload.repository),
    context.payload.repository.html_url,
    repoContext.config.labels.list,
    reviewflowPrContext.commentBody,
    repoContext.config.prDefaultOptions,
    updateOptions,
  );

  await updatePrCommentBodyIfNeeded(context, reviewflowPrContext, newBody);
};
