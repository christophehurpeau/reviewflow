import type { LockedMergePr } from '../../../context/repoContext';
import type { PullRequestData } from './PullRequestData';

export const createMergeLockPrFromPr = (
  pullRequest: PullRequestData,
): LockedMergePr => ({
  id: pullRequest.id,
  number: pullRequest.number,
  branch: pullRequest.head.ref,
});
