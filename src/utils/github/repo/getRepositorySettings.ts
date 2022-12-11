import type { Context } from 'probot';

export interface RepositorySettingsQueryResult {
  repository: {
    autoMergeAllowed: boolean;
    deleteBranchOnMerge: boolean;
    defaultBranchRef: {
      name: string;
    };
    mergeCommitAllowed: boolean;
    rebaseMergeAllowed: boolean;
    squashMergeAllowed: boolean;
  };
}

export const getRepositorySettings = (
  context: Context,
): Promise<RepositorySettingsQueryResult> =>
  context.octokit.graphql(
    `
query repository($owner: String!, $repo: String!) {
  repository(owner: $owner, name: $repo) {
    autoMergeAllowed
    deleteBranchOnMerge
    defaultBranchRef {
      name
    }
    mergeCommitAllowed
    rebaseMergeAllowed
    squashMergeAllowed
  }
}`,
    context.repo(),
  );
