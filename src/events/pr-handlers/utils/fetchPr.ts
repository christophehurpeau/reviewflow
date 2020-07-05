import { Context, Octokit } from 'probot';

export const fetchPr = async (
  context: Context<any>,
  prNumber: number,
): Promise<Octokit.PullsGetResponse> => {
  const prResult = await context.github.pulls.get(
    context.repo({ pull_number: prNumber }),
  );

  return prResult.data;
};
