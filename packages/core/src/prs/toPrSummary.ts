import type {
  PrChecksSummary,
  PrStatusLink,
  PrSummary,
  PrUserSummary,
} from "reviewflow-modules";
import { accountConfigs } from "../accountConfigs/index.ts";
import { buildPullRequestUrl } from "../buildPullRequestUrl.ts";
import { getFailedOrWaitingChecksAndStatuses } from "../checksAndStatuses/getFailedOrWaitingChecksAndStatuses.ts";
import type { ReviewflowStatus } from "../models/ReviewflowStatus.ts";
import type { ReviewflowPr } from "../mongo.ts";

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
    runningCount,
    failedNames,
  };
};

const hasLintFailure = ({ lintStatuses }: ReviewflowPr): boolean =>
  lintStatuses?.some(({ status }) => status.type === "failure") ?? false;

const markdownLinkRegExp = /^\[(?<label>[^\]]+)\]\(\S+\)$/;

/**
 * A status carrying a url is worth linking to, whatever it means. Its summary is
 * the only place a short label lives: the account configs write it as a markdown
 * link whose text is the ticket or issue key, while the title is prose meant for
 * the github check.
 */
const toStatusLinkLabel = ({ summary, title }: ReviewflowStatus["status"]) =>
  markdownLinkRegExp.exec(summary)?.groups?.label ?? title;

const toStatusLinks = ({ lintStatuses }: ReviewflowPr): PrStatusLink[] =>
  lintStatuses?.flatMap(({ name, status }) =>
    status.url === undefined
      ? []
      : [
          {
            name,
            label: toStatusLinkLabel(status),
            url: status.url,
            type: status.type,
          },
        ],
  ) ?? [];

/** documents written before a field existed reach this without it */
const toUserSummaries = (
  users: { id: number; login: string }[] | undefined,
): PrUserSummary[] => users?.map(({ id, login }) => ({ id, login })) ?? [];

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
  statusLinks: toStatusLinks(pr),
  approvedCount: pr.reviews?.approved.length ?? 0,
  changesRequestedBy: toUserSummaries(pr.reviews?.changesRequested),
  requestedReviewers: toUserSummaries(pr.reviews?.reviewRequested),
  requestedTeams: pr.reviews?.teamReviewRequested.map(({ name }) => name) ?? [],
  assignees:
    pr.assignees?.map(({ id, login, avatar_url: avatarUrl }) => ({
      id,
      login,
      avatarUrl,
    })) ?? [],
  creator: pr.creator
    ? {
        id: pr.creator.id,
        login: pr.creator.login,
        avatarUrl: pr.creator.avatar_url,
      }
    : undefined,
  changes: pr.changesInformation,
  openedAt: pr.flowDates?.openedAt,
  approvedAt: pr.flowDates?.approvedAt,
});
