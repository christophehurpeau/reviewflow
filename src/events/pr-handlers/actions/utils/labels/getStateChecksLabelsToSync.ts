import type { CIState } from 'events/pr-handlers/utils/getFailedOrWaitingChecksAndStatuses';
import type { RepoContext } from '../../../../../context/repoContext';
import type { LabelToSync } from '../syncLabel';

export const getStateChecksLabelsToSync = <GroupNames extends string>(
  repoContext: RepoContext<GroupNames>,
  state: CIState,
): LabelToSync[] => {
  return [
    {
      label: repoContext.labels['checks/in-progress'],
      shouldHaveLabel: state === 'pending',
    },
    {
      label: repoContext.labels['checks/failed'],
      shouldHaveLabel: state === 'failed',
    },
    {
      label: repoContext.labels['checks/passed'],
      shouldHaveLabel: state === 'passed',
    },
  ];
};
