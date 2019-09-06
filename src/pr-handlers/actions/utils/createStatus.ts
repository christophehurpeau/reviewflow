import Webhooks from '@octokit/webhooks';
import { Context } from 'probot';

export default async function createStatus<
  T extends Webhooks.WebhookPayloadPullRequest
>(
  context: Context<T>,
  name: string,
  sha: string,
  type: 'failure' | 'success',
  description: string,
  url?: string,
): Promise<void> {
  await context.github.repos.createStatus(
    context.repo({
      context:
        name === ''
          ? process.env.REVIEWFLOW_NAME
          : `${process.env.REVIEWFLOW_NAME}/${name}`,
      sha,
      state: type,
      description,
      target_url: url,
    }),
  );
}
