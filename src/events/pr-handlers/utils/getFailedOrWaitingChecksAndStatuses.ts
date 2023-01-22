import type { RepoContext } from '../../../context/repoContext';
import type { ChecksAndStatuses } from '../../../utils/github/pullRequest/checksAndStatuses';

export type CIState = 'pending' | 'passed' | 'failed';

export interface FailedOrWaitingChecksAndStatuses {
  failedChecks: string[];
  pendingChecks: string[];
  failedStatuses: string[];
  pendingStatuses: string[];
  state: CIState;
}

export const isCheckNotAllowedToFail = (
  repoContext: RepoContext,
  checkName: string,
): boolean =>
  !checkName ||
  !repoContext.config.checksAllowedToFail ||
  repoContext.config.checksAllowedToFail.every((name) =>
    name.endsWith('/') ? !checkName.startsWith(name) : checkName !== name,
  );

export const isPendingCheckShouldBeIgnored = (checkName: string): boolean =>
  // see https://github.com/christophehurpeau/nightingale/pull/643, when label change codecov check goes to in-progress again
  checkName?.includes('codecov') || checkName?.includes('/hold-');

export const getFailedOrWaitingChecksAndStatuses = <GroupNames extends string>(
  { checksConclusionRecord, statusesConclusionRecord }: ChecksAndStatuses,
  repoContext: RepoContext<GroupNames>,
): FailedOrWaitingChecksAndStatuses => {
  const checksEntries = Object.entries(checksConclusionRecord);
  const statusesEntries = Object.entries(statusesConclusionRecord);

  const failedChecks = checksEntries
    .filter(
      ([checkId, { name, conclusion }]) =>
        (conclusion === 'failure' ||
          conclusion === 'cancelled' ||
          conclusion === 'timed_out') &&
        isCheckNotAllowedToFail(repoContext, name),
    )
    .map(([checkName]) => checkName);

  const pendingChecks = checksEntries
    .filter(([checkId, { conclusion }]) => conclusion == null)
    .map(([checkId, { name }]) => name);

  const failedStatuses = statusesEntries
    .filter(
      ([, { context: statusContext, state: statusState }]) =>
        (statusState === 'failure' || statusState === 'error') &&
        isCheckNotAllowedToFail(repoContext, statusContext),
    )
    .map(([, { context: statusContext }]) => statusContext);

  const pendingStatuses = statusesEntries
    .filter(
      ([, { context: statusContext, state: statusState }]) =>
        statusState === 'pending' &&
        !isPendingCheckShouldBeIgnored(statusContext),
    )
    .map(([, { context: statusContext }]) => statusContext);

  const calcState = (): CIState => {
    if (failedChecks.length > 0 || failedStatuses.length > 0) return 'failed';
    if (pendingChecks.length > 0 || pendingStatuses.length > 0) {
      return 'pending';
    }
    return 'passed';
  };

  return {
    failedChecks,
    pendingChecks,
    failedStatuses,
    pendingStatuses,
    state: calcState(),
  };
};
