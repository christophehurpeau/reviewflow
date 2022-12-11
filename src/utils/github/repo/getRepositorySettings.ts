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
): Promise<RepositorySettingsQueryResult> => {
  if (process.env.NODE_ENV === 'test') {
    return Promise.resolve({
      repository: {
        autoMergeAllowed: true,
        deleteBranchOnMerge: true,
        defaultBranchRef: { name: 'main' },
        mergeCommitAllowed: true,
        rebaseMergeAllowed: true,
        squashMergeAllowed: true,
      },
    });
  }
  return context.octokit.graphql(
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
};
