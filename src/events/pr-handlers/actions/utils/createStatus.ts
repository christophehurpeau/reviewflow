import type { StatusInfo } from '../../../../accountConfigs/types';
import type { EventsWithRepository } from '../../../../context/repoContext';
import type { ProbotEvent } from '../../../probot-types';

export default async function createStatus<
  EventName extends EventsWithRepository,
>(
  context: ProbotEvent<EventName>,
  name: string,
  sha: string,
  status: StatusInfo,
): Promise<void> {
  let description = status.title;
  if (description.length > 140) {
    context.log.warn('description too long', { description });
    description = description.slice(0, 140);
  }

  await context.octokit.repos.createCommitStatus(
    context.repo({
      context:
        name === ''
          ? process.env.REVIEWFLOW_NAME
          : `${process.env.REVIEWFLOW_NAME}/${name}`,
      sha,
      state: status.type,
      description,
      target_url: status.url,
    }),
  );
}

export const isSameStatus = (
  status1: StatusInfo,
  status2: StatusInfo,
): boolean => {
  return (
    status1.type === status2.type &&
    status1.title === status2.title &&
    status1.summary === status2.summary &&
    // eslint-disable-next-line eqeqeq
    status1.url == status2.url // allow both null and undefined
  );
};
