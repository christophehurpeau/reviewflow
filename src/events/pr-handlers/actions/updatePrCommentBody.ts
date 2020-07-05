import Webhooks from '@octokit/webhooks';
import { Context, Octokit } from 'probot';
import { PrContext } from '../utils/createPullRequestContext';
import { updateCommentOptions } from './utils/body/updateBody';
import { Options } from './utils/body/prOptions';
import { updatePrIfNeeded } from './updatePr';

export const updatePrCommentBody = async <
  E extends Webhooks.WebhookPayloadPullRequest
>(
  prContext: PrContext<E['pull_request'] | Octokit.PullsGetResponse>,
  context: Context<E>,
  updateOptions: Partial<Options>,
): Promise<void> => {
  const { commentBody: newBody } = updateCommentOptions(
    prContext.commentBody,
    prContext.repoContext.config.prDefaultOptions,
    updateOptions,
  );

  await updatePrIfNeeded(prContext, context, { commentBody: newBody });
};
