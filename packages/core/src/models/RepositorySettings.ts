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
        requiresConversationResolution: boolean;
        // requiredStatusChecks: {
        //   app: { id: string; name: string } | null;
        //   context: string;
        // }[];
      }[];
    };
  };
  rulesets: { requiresConversationResolution: boolean };
}

export interface RepositorySettings {
  defaultBranch: string;
  deleteBranchOnMerge?: boolean;
  allowAutoMerge?: boolean;
  allowRebaseMerge?: boolean;
  allowSquashMerge?: boolean;
  allowMergeCommit?: boolean;
  defaultBranchProtectionRules?: {
    // requiredStatusChecks: RepositorySettingsQueryResult["repository"]["branchProtectionRules"]["nodes"][number]["requiredStatusChecks"];
    requiresStatusChecks?: RepositorySettingsQueryResult["repository"]["branchProtectionRules"]["nodes"][number]["requiresStatusChecks"];
    requiresConversationResolution?: boolean;
  } | null;
  lastUpdated?: Date;
}
