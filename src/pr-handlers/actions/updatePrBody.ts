import Webhooks from '@octokit/webhooks';
import { Context } from 'probot';
import { RepoContext } from '../../context/repoContext';
import { updateBody } from './utils/updateBody';
import { Options } from './utils/prOptions';

export const updatePrBody = async <
  E extends Webhooks.WebhookPayloadPullRequest
>(
  context: Context<E>,
  repoContext: RepoContext,
  updateOptions: Partial<Record<Options, boolean>>,
): Promise<void> => {
  const prBody = context.payload.pull_request.body;
  const { body } = updateBody(
    prBody,
    repoContext.config.prDefaultOptions,
    undefined,
    updateOptions,
  );

  if (body !== prBody) {
    await context.github.pulls.update(context.issue({ body }));
  }
};
