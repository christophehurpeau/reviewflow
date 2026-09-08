/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import type { ChecksAndStatuses } from "../models/ChecksAndStatuses.ts";

export type ChecksAndStatusesState = "failed" | "passed" | "pending";

export interface FailedOrWaitingChecksAndStatuses {
  failedChecks: string[];
  pendingChecks: string[];
  failedStatuses: string[];
  pendingStatuses: string[];
  state: ChecksAndStatusesState;
}

export const isCheckNotAllowedToFail = (
  checksAllowedToFail: string[] | undefined,
  checkName: string,
): boolean =>
  !checkName ||
  !checksAllowedToFail ||
  checksAllowedToFail.every((name) =>
    name.endsWith("/") ? !checkName.startsWith(name) : checkName !== name,
  );

export const isPendingCheckShouldBeIgnored = (
  checkName: string | undefined,
): boolean | undefined =>
  // see https://github.com/christophehurpeau/nightingale/pull/643, when label change codecov check goes to in-progress again
  checkName?.includes("codecov") || checkName?.includes("/hold-");

const isDefinedName = (name: string | undefined): name is string => !!name;

export const getFailedOrWaitingChecksAndStatuses = (
  { checksConclusionRecord, statusesConclusionRecord }: ChecksAndStatuses,
  checksAllowedToFail: string[] | undefined,
): FailedOrWaitingChecksAndStatuses => {
  const checksEntries = Object.entries(checksConclusionRecord);
  const statusesEntries = Object.entries(statusesConclusionRecord);

  const failedChecks = checksEntries
    .filter(
      ([, check]) =>
        (check?.conclusion === "failure" ||
          check?.conclusion === "cancelled" ||
          check?.conclusion === "timed_out") &&
        !check?.name.includes("/hold-") &&
        isCheckNotAllowedToFail(checksAllowedToFail, check.name),
    )
    .map(([checkId, check]) => check?.name || checkId)
    .filter(isDefinedName);

  const pendingChecks = checksEntries
    .filter(
      ([, check]) =>
        check &&
        check.conclusion == null &&
        !isPendingCheckShouldBeIgnored(check.name),
    )
    .map(([checkId, check]) => check?.name || checkId)
    .filter(isDefinedName);

  const failedStatuses = statusesEntries
    .filter(
      ([, status]) =>
        (status?.state === "failure" || status?.state === "error") &&
        !status?.context.includes("/hold-") &&
        isCheckNotAllowedToFail(checksAllowedToFail, status.context),
    )
    .map(([, status]) => status?.context)
    .filter(isDefinedName);

  const pendingStatuses = statusesEntries
    .filter(
      ([, status]) =>
        status?.state === "pending" &&
        !isPendingCheckShouldBeIgnored(status.context),
    )
    .map(([, status]) => status?.context)
    .filter(isDefinedName);

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
