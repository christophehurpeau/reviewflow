import type { Context } from "probot";
import type { RepositorySettingsQueryResult } from "reviewflow-core";

export interface RepositoryRef {
  owner: string;
  repo: string;
}

export interface GraphqlOctokit {
  graphql: <T>(query: string, parameters: Record<string, string>) => Promise<T>;
}

const repositorySettingsQuery = `
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
    branchProtectionRules (first: 100) {
      nodes {
        matchingRefs (first: 100) {
          nodes {
            name
          }
        }
        requiresStatusChecks
      }
    }
  }
}`;

const testRepositorySettings: RepositorySettingsQueryResult = {
  repository: {
    autoMergeAllowed: true,
    deleteBranchOnMerge: true,
    defaultBranchRef: { name: "main" },
    mergeCommitAllowed: true,
    rebaseMergeAllowed: true,
    squashMergeAllowed: true,
    branchProtectionRules: {
      nodes: [
        {
          matchingRefs: { nodes: [{ name: "main" }] },
          requiresStatusChecks: true,
          // requiredStatusChecks: [
          //   { app: null, context: "reviewflow" },
          //   {
          //     app: { id: "MDM6QXBwMTUzNjg=", name: "GitHub Actions" },
          //     context: "test (18)",
          //   },
          // ],
        },
      ],
    },
  },
};

export const fetchRepositorySettings = (
  octokit: GraphqlOctokit,
  { owner, repo }: RepositoryRef,
): Promise<RepositorySettingsQueryResult> => {
  if (process.env.NODE_ENV === "test") {
    return Promise.resolve(testRepositorySettings);
  }
  return octokit.graphql<RepositorySettingsQueryResult>(
    repositorySettingsQuery,
    { owner, repo },
  );
};

export const getRepositorySettings = (
  context: Context,
): Promise<RepositorySettingsQueryResult> =>
  fetchRepositorySettings(context.octokit, context.repo());

// not allowed
/*
requiredStatusChecks {
          app { id, name }
          context
        }
        */
