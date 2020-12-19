import type { EventPayloads } from '@octokit/webhooks';
import type { Context } from 'probot';

export default async function createStatus<
  T extends { repository: EventPayloads.PayloadRepository }
>(
  context: Context<T>,
  name: string,
  sha: string,
  type: 'failure' | 'success',
  description: string,
  url?: string,
): Promise<void> {
  await context.octokit.repos.createCommitStatus(
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
