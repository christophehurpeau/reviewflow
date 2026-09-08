import type { ReviewflowPr } from "reviewflow-core";
import {
  accountConfigs,
  buildPullRequestUrl,
  getFailedOrWaitingChecksAndStatuses,
} from "reviewflow-core";
import type { PrChecksSummary, PrSummary } from "reviewflow-modules";

const toChecksSummary = ({
  account,
  checksConclusion,
  statusesConclusion,
}: ReviewflowPr): PrChecksSummary => {
  const checksConclusionRecord = checksConclusion ?? {};
  const statusesConclusionRecord = statusesConclusion ?? {};

  const {
    failedChecks,
    failedStatuses,
    pendingChecks,
    pendingStatuses,
    state,
  } = getFailedOrWaitingChecksAndStatuses(
    { checksConclusionRecord, statusesConclusionRecord },
    accountConfigs[account.login]?.checksAllowedToFail,
  );

  const failedNames = [...failedChecks, ...failedStatuses];
  const runningCount = pendingChecks.length + pendingStatuses.length;

  const hasNoCheckNorStatus =
    Object.keys(checksConclusionRecord).length === 0 &&
    Object.keys(statusesConclusionRecord).length === 0;

  const conclusion = (() => {
    if (hasNoCheckNorStatus) return "unknown";
    if (state === "failed") return "failed";
    return state === "pending" ? "in-progress" : "passed";
  })();

  return {
    conclusion,
    failedCount: failedNames.length,
    runningCount,
    failedNames,
  };
};

const hasLintFailure = ({ lintStatuses }: ReviewflowPr): boolean =>
  lintStatuses?.some(({ status }) => status.type === "failure") ?? false;

export const toPrSummary = (pr: ReviewflowPr): PrSummary => ({
  _id: pr._id,
  orgLogin: pr.account.login,
  repoName: pr.repo.name,
  number: pr.pr.number,
  title: pr.title,
  url: buildPullRequestUrl(pr),
  isDraft: pr.isDraft,
  checks: toChecksSummary(pr),
  lintFailed: hasLintFailure(pr),
  approvedCount: pr.reviews.approved.length,
  changesRequestedCount: pr.reviews.changesRequested.length,
  requestedReviewers: pr.reviews.reviewRequested.map(({ id, login }) => ({
    id,
    login,
  })),
  requestedTeams: pr.reviews.teamReviewRequested.map(({ name }) => name),
  assignees: pr.assignees.map(({ id, login, avatar_url: avatarUrl }) => ({
    id,
    login,
    avatarUrl,
  })),
  creator: pr.creator
    ? {
        id: pr.creator.id,
        login: pr.creator.login,
        avatarUrl: pr.creator.avatar_url,
      }
    : undefined,
  changes: pr.changesInformation,
  openedAt: pr.flowDates?.openedAt,
});
