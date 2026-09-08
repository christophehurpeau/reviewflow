import type {
  ChecksAndStatuses,
  FailedOrWaitingChecksAndStatuses,
} from "reviewflow-core";
import {
  getFailedOrWaitingChecksAndStatuses as getFailedOrWaitingChecksAndStatusesFromConfig,
  isCheckNotAllowedToFail as isCheckNotAllowedToFailWithConfig,
} from "reviewflow-core";
import type { RepoContext } from "../../../context/repoContext.ts";

export type {
  ChecksAndStatusesState,
  FailedOrWaitingChecksAndStatuses,
} from "reviewflow-core";

export const isCheckNotAllowedToFail = (
  repoContext: RepoContext,
  checkName: string,
): boolean =>
  isCheckNotAllowedToFailWithConfig(
    repoContext.config.checksAllowedToFail,
    checkName,
  );

export const getFailedOrWaitingChecksAndStatuses = <TeamNames extends string>(
  checksAndStatuses: ChecksAndStatuses,
  repoContext: RepoContext<TeamNames>,
): FailedOrWaitingChecksAndStatuses =>
  getFailedOrWaitingChecksAndStatusesFromConfig(
    checksAndStatuses,
    repoContext.config.checksAllowedToFail,
  );
