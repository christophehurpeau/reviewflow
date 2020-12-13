import type { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods';
import type { Context } from 'probot';

export const fetchPr = async (
  context: Context<any>,
  prNumber: number,
): Promise<RestEndpointMethodTypes['pulls']['get']['response']['data']> => {
  const prResult = await context.octokit.pulls.get(
    context.repo({ pull_number: prNumber }),
  );

  return prResult.data;
};
