import type { ProbotEvent } from '../../../../probot-types';

export interface RepositoryOptions {
  defaultBranch: string;
  deleteBranchOnMerge?: boolean;
  allowAutoMerge?: boolean;
  allowRebaseMerge?: boolean;
  allowSquashMerge?: boolean;
  allowMergeCommit?: boolean;
}

export function parseRepositoryOptions<Name extends 'repository.edited'>(
  repository: ProbotEvent<Name>['payload']['repository'],
): RepositoryOptions {
  return {
    defaultBranch: repository.default_branch,
    deleteBranchOnMerge: repository.delete_branch_on_merge,
    allowAutoMerge: repository.allow_auto_merge,
    allowRebaseMerge: repository.allow_rebase_merge,
    allowSquashMerge: repository.allow_squash_merge,
    allowMergeCommit: repository.allow_merge_commit,
  };
}
