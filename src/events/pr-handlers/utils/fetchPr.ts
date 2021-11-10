import type { RestEndpointMethodTypes } from '@octokit/rest';
import type { EmitterWebhookEventName } from '@octokit/webhooks';
import type { ProbotEvent } from 'events/probot-types';

export type PullRequestFromRestEndpoint =
  RestEndpointMethodTypes['pulls']['get']['response']['data'];

export const fetchPr = async <T extends EmitterWebhookEventName>(
  context: ProbotEvent<T>,
  prNumber: number,
): Promise<PullRequestFromRestEndpoint> => {
  const prResult = await context.octokit.pulls.get(
    context.repo({ pull_number: prNumber }),
  );

  return prResult.data;
};
