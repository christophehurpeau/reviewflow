import type { EventsWithRepository } from 'context/repoContext';
import type { ProbotEvent } from 'events/probot-types';

export default async function createStatus<
  EventName extends EventsWithRepository,
>(
  context: ProbotEvent<EventName>,
  name: string,
  sha: string,
  type: 'failure' | 'success',
  description: string,
  url?: string,
): Promise<void> {
  if (description.length > 140) {
    context.log('description too long', { description });
    description = description.slice(0, 140);
  }

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
