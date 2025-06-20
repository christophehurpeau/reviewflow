import type { RepoContext } from "../../../context/repoContext.ts";
import { ExcludesFalsy } from "../../../utils/Excludes.ts";
import type { ChecksAndStatuses } from "../../../utils/github/pullRequest/checksAndStatuses.ts";

export type ChecksAndStatusesState = "failed" | "passed" | "pending";

export interface FailedOrWaitingChecksAndStatuses {
  failedChecks: string[];
  pendingChecks: string[];
  failedStatuses: string[];
  pendingStatuses: string[];
  state: ChecksAndStatusesState;
}

export const isCheckNotAllowedToFail = (
  repoContext: RepoContext,
  checkName: string,
): boolean =>
  !checkName ||
  !repoContext.config.checksAllowedToFail ||
  repoContext.config.checksAllowedToFail.every((name) =>
    name.endsWith("/") ? !checkName.startsWith(name) : checkName !== name,
  );

export const isPendingCheckShouldBeIgnored = (
  checkName: string | undefined,
): boolean | undefined =>
  // see https://github.com/christophehurpeau/nightingale/pull/643, when label change codecov check goes to in-progress again
  checkName?.includes("codecov") || checkName?.includes("/hold-");

export const getFailedOrWaitingChecksAndStatuses = <TeamNames extends string>(
  { checksConclusionRecord, statusesConclusionRecord }: ChecksAndStatuses,
  repoContext: RepoContext<TeamNames>,
): FailedOrWaitingChecksAndStatuses => {
  const checksEntries = Object.entries(checksConclusionRecord);
  const statusesEntries = Object.entries(statusesConclusionRecord);

  const failedChecks = checksEntries
    .filter(
      ([checkId, check]) =>
        (check?.conclusion === "failure" ||
          check?.conclusion === "cancelled" ||
          check?.conclusion === "timed_out") &&
        isCheckNotAllowedToFail(repoContext, check.name),
    )
    .map(([checkName]) => checkName)
    .filter(ExcludesFalsy);

  const pendingChecks = checksEntries
    .filter(
      ([checkId, check]) =>
        check &&
        check.conclusion == null &&
        !isPendingCheckShouldBeIgnored(check.name),
    )
    .map(([checkId, check]) => check?.name)
    .filter(ExcludesFalsy);

  const failedStatuses = statusesEntries
    .filter(
      ([, status]) =>
        (status?.state === "failure" || status?.state === "error") &&
        isCheckNotAllowedToFail(repoContext, status.context),
    )
    .map(([, status]) => status?.context)
    .filter(ExcludesFalsy);

  const pendingStatuses = statusesEntries
    .filter(
      ([, status]) =>
        status?.state === "pending" &&
        !isPendingCheckShouldBeIgnored(status.context),
    )
    .map(([, status]) => status?.context)
    .filter(ExcludesFalsy);

  const calcState = (): ChecksAndStatusesState => {
    if (failedChecks.length > 0 || failedStatuses.length > 0) return "failed";
    if (pendingChecks.length > 0 || pendingStatuses.length > 0) {
      return "pending";
    }
    return "passed";
  };

  return {
    failedChecks,
    pendingChecks,
    failedStatuses,
    pendingStatuses,
    state: calcState(),
  };
};
