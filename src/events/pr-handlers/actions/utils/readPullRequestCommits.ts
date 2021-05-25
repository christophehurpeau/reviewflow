import type { RestEndpointMethodTypes } from '@octokit/rest';
import type { EventPayloads } from '@octokit/webhooks';
import type { Context } from 'probot';
import type { PullRequestData } from 'events/pr-handlers/utils/PullRequestData';

export function readPullRequestCommits<
  E extends EventPayloads.WebhookPayloadPullRequest,
>(
  context: Context<E>,
  pr: PullRequestData = context.payload.pull_request,
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
