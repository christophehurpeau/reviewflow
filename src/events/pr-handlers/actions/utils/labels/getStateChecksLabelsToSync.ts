import type { CIState } from 'events/pr-handlers/utils/getFailedOrWaitingChecksAndStatuses';
import type { RepoContext } from '../../../../../context/repoContext';
import type { LabelToSync } from '../syncLabel';

export const getStateChecksLabelsToSync = <TeamNames extends string>(
  repoContext: RepoContext<TeamNames>,
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
