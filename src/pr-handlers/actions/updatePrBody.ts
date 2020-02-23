import Webhooks from '@octokit/webhooks';
import { Context, Octokit } from 'probot';
import { RepoContext } from '../../context/repoContext';
import { updateBody } from './utils/updateBody';
import { Options } from './utils/prOptions';
import { updatePrIfNeeded } from './updatePr';

export const updatePrBody = async <
  E extends Webhooks.WebhookPayloadPullRequest
>(
  pr: Octokit.PullsGetResponse,
  context: Context<E>,
  repoContext: RepoContext,
  updateOptions: Partial<Record<Options, boolean>>,
): Promise<void> => {
  const { body } = updateBody(
    pr.body,
    repoContext.config.prDefaultOptions,
    undefined,
    updateOptions,
  );

  await updatePrIfNeeded(pr, context, repoContext, { body });
};
