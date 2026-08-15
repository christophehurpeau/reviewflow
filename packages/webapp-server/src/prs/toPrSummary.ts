import type { ReviewflowPr } from "reviewflow-core";
import { buildPullRequestUrl } from "reviewflow-core";
import type { PrChecksSummary, PrSummary } from "reviewflow-modules";

const toChecksSummary = ({
  checksConclusion,
  statusesConclusion,
}: ReviewflowPr): PrChecksSummary => {
  const checks = Object.values(checksConclusion ?? {});
  const statuses = Object.values(statusesConclusion ?? {});

  const failedNames = [
    ...checks
      .filter(
        ({ conclusion }) =>
          conclusion === "failure" ||
          conclusion === "cancelled" ||
          conclusion === "timed_out",
      )
      .map(({ name }) => name),
    ...statuses
      .filter(({ state }) => state === "failure" || state === "error")
      .map(({ context }) => context),
  ];

  const runningCount =
    checks.filter(({ conclusion }) => conclusion == null).length +
    statuses.filter(({ state }) => state === "pending").length;

  const conclusion = (() => {
    if (checks.length === 0 && statuses.length === 0) return "unknown";
    if (failedNames.length > 0) return "failed";
    return runningCount > 0 ? "in-progress" : "passed";
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
