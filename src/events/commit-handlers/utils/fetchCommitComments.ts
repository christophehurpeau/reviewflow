import type { RestEndpointMethodTypes } from '@octokit/rest';
import type { EmitterWebhookEventName } from '@octokit/webhooks';
import type { ProbotEvent } from 'events/probot-types';

export type CommitFromRestEndpoint =
  RestEndpointMethodTypes['repos']['listCommentsForCommit']['response']['data'];

export const fetchCommitComments = async <T extends EmitterWebhookEventName>(
  context: ProbotEvent<T>,
  commit_sha: string,
): Promise<CommitFromRestEndpoint> => {
  return context.octokit.paginate(
    context.octokit.repos.listCommentsForCommit,
    context.repo({
      commit_sha,
    }),
  );
};
