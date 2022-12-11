import type { RepositorySettingsQueryResult } from '../../../../../utils/github/repo/getRepositorySettings';

export interface RepositorySettings {
  defaultBranch: string;
  deleteBranchOnMerge?: boolean;
  allowAutoMerge?: boolean;
  allowRebaseMerge?: boolean;
  allowSquashMerge?: boolean;
  allowMergeCommit?: boolean;
}

export function createRepositorySettings({
  repository,
}: RepositorySettingsQueryResult): RepositorySettings {
  return {
    defaultBranch: repository.defaultBranchRef.name,
    deleteBranchOnMerge: repository.deleteBranchOnMerge,
    allowAutoMerge: repository.autoMergeAllowed,
    allowRebaseMerge: repository.rebaseMergeAllowed,
    allowSquashMerge: repository.squashMergeAllowed,
    allowMergeCommit: repository.mergeCommitAllowed,
  };
}
