import type { Context } from "probot";

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
    branchProtectionRules: {
      nodes: {
        matchingRefs: { nodes: { name: string }[] };
        requiresStatusChecks: boolean;
        // requiredStatusChecks: {
        //   app: { id: string; name: string } | null;
        //   context: string;
        // }[];
      }[];
    };
  };
}

export const getRepositorySettings = (
  context: Context,
): Promise<RepositorySettingsQueryResult> => {
  if (process.env.NODE_ENV === "test") {
    return Promise.resolve({
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
}`,
    context.repo(),
  );
};

// not allowed
/*
requiredStatusChecks {
          app { id, name }
          context
        }
        */
