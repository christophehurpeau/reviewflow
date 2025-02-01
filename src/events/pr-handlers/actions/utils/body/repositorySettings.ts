import type { RepositorySettingsQueryResult } from "../../../../../utils/github/repo/getRepositorySettings";

export interface RepositorySettings {
  defaultBranch: string;
  deleteBranchOnMerge?: boolean;
  allowAutoMerge?: boolean;
  allowRebaseMerge?: boolean;
  allowSquashMerge?: boolean;
  allowMergeCommit?: boolean;
  defaultBranchProtectionRules?: {
    // requiredStatusChecks: RepositorySettingsQueryResult["repository"]["branchProtectionRules"]["nodes"][number]["requiredStatusChecks"];
    requiresStatusChecks: RepositorySettingsQueryResult["repository"]["branchProtectionRules"]["nodes"][number]["requiresStatusChecks"];
  } | null;
  lastUpdated?: Date;
}

export function createRepositorySettings({
  repository,
}: RepositorySettingsQueryResult): RepositorySettings {
  const defaultBranchProtectionRules =
    repository.branchProtectionRules.nodes.find((node) =>
      node.matchingRefs.nodes.some(
        ({ name }) => name === repository.defaultBranchRef.name,
      ),
    );
  return {
    defaultBranch: repository.defaultBranchRef.name,
    deleteBranchOnMerge: repository.deleteBranchOnMerge,
    allowAutoMerge: repository.autoMergeAllowed,
    allowRebaseMerge: repository.rebaseMergeAllowed,
    allowSquashMerge: repository.squashMergeAllowed,
    allowMergeCommit: repository.mergeCommitAllowed,
    defaultBranchProtectionRules: !defaultBranchProtectionRules
      ? null
      : {
          requiresStatusChecks:
            defaultBranchProtectionRules.requiresStatusChecks,
          // requiredStatusChecks:
          //   defaultBranchProtectionRules.requiredStatusChecks,
        },
    lastUpdated: new Date(),
  };
}

export function isSettingsLastUpdatedExpired({
  lastUpdated,
}: RepositorySettings): boolean {
  if (!lastUpdated) return false;

  const date = new Date();
  date.setMinutes(date.getMinutes() - 1);

  return lastUpdated.getTime() < date.getTime();
}
