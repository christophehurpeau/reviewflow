import type { RestEndpointMethodTypes } from '@octokit/rest';
import type { EventsWithRepository } from 'context/repoContext';
import type { PullRequestData } from 'events/pr-handlers/utils/PullRequestData';
import type { ProbotEvent } from 'events/probot-types';

export function readPullRequestCommits<EventName extends EventsWithRepository>(
  context: ProbotEvent<EventName>,
  pr: PullRequestData,
): Promise<
  RestEndpointMethodTypes['pulls']['listCommits']['response']['data']
> {
  return context.octokit.paginate(
    context.octokit.pulls.listCommits,
    context.repo({
      pull_number: pr.number,
      // A custom page size up to 100. Default is 30.
      per_page: 100,
    }),
    (res) => res.data,
  );
}
