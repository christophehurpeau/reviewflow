import type { ReviewflowPrChanges } from "../types/reviewflow.ts";
import { pluralOf } from "../utils/pluralOf.ts";
import type { FormatRelativeDateOptions } from "../utils/relativeDate.ts";
import { formatRelativeDate } from "../utils/relativeDate.ts";
import type { ReviewflowBoardPr } from "./board.ts";

/**
 * What reviewflow's own board row says about a pull request, in its wording so
 * the two boards read the same. The status line comes in three parts by how
 * loudly each is shown: what blocks the merge, changes requested, the rest.
 */

export const maxFailedCheckNames = 9;

/** Where a row is shown, which decides what it leaves to its bucket's title. */
export interface ReviewflowRowContext {
  bucketKey: string;
  groupKey: string;
  /** the token's login, named "you" */
  viewer: string | null;
}

/** the buckets whose title already says whether the checks pass */
const bucketsSilentOnPassedChecks = new Set(["changes-requested", "drafts"]);
/** the bucket whose title already says every reviewer was asked again */
const reRequestedBucket = "re-requested-reviews";
/** someone else's pull request requests a review, the operator's awaits one */
const requestingAttentionGroup = "requesting-attention";

const people = (logins: string[], viewer: string | null): string =>
  logins.map((login) => (login === viewer ? "you" : `@${login}`)).join(", ");

const failedChecksText = ({
  checksConclusion,
  failedChecks,
}: Pick<ReviewflowBoardPr, "checksConclusion" | "failedChecks">):
  | string
  | null => {
  if (failedChecks.length === 0) {
    return checksConclusion === "failed" ? "checks failed" : null;
  }
  const names = failedChecks.slice(0, maxFailedCheckNames).join(", ");
  const remaining = failedChecks.length - maxFailedCheckNames;
  const more = remaining > 0 ? ` +${String(remaining)}` : "";
  return `${failedChecks.length === 1 ? "check" : "checks"} failed: ${names}${more}`;
};

/**
 * Failing checks (after reviewflow's allowed-to-fail rules, by name), a failed
 * pr lint and a merge conflict; null when nothing blocks.
 */
export const reviewflowPrFailure = (
  pr: Pick<
    ReviewflowBoardPr,
    "checksConclusion" | "failedChecks" | "lintFailed" | "mergeable"
  >,
): string | null => {
  const parts = [
    failedChecksText(pr),
    pr.lintFailed ? "pr lint failed" : null,
    pr.mergeable === "conflicting" ? "conflicts" : null,
  ].filter((part) => part !== null);
  return parts.length === 0 ? null : parts.join(" · ");
};

export const reviewflowPrChangesRequested = (
  { changesRequestedBy }: Pick<ReviewflowBoardPr, "changesRequestedBy">,
  viewer: string | null,
): string | null =>
  changesRequestedBy.length === 0
    ? null
    : `changes requested by ${people(changesRequestedBy, viewer)}`;

const checksProgressText = (
  {
    checksConclusion,
    checksRunning,
  }: Pick<ReviewflowBoardPr, "checksConclusion" | "checksRunning">,
  bucketKey: string,
): string | null => {
  if (checksRunning > 0) {
    return `${pluralOf(checksRunning, "check")} running`;
  }
  return checksConclusion === "passed" &&
    !bucketsSilentOnPassedChecks.has(bucketKey)
    ? "checks passed"
    : null;
};

const awaitedText = (
  {
    requestedReviewers,
    reRequestedReviewers,
    requestedTeams,
  }: Pick<
    ReviewflowBoardPr,
    "requestedReviewers" | "requestedTeams" | "reRequestedReviewers"
  >,
  { bucketKey, groupKey, viewer }: ReviewflowRowContext,
): string | null => {
  const reviewers = [
    ...requestedReviewers,
    ...(bucketKey === reRequestedBucket ? [] : reRequestedReviewers),
  ];
  if (reviewers.length === 0 && requestedTeams.length === 0) return null;
  const verb = groupKey === requestingAttentionGroup ? "requested" : "awaiting";
  const awaited = [
    ...(reviewers.length === 0 ? [] : [people(reviewers, viewer)]),
    ...requestedTeams.map((team) => `#${team}`),
  ];
  return `${verb} ${awaited.join(", ")}`;
};

/** running or passed checks, approvals, open threads, awaited reviewers */
export const reviewflowPrProgress = (
  pr: Pick<
    ReviewflowBoardPr,
    | "approvedBy"
    | "checksConclusion"
    | "checksRunning"
    | "requestedReviewers"
    | "requestedTeams"
    | "reRequestedReviewers"
    | "unresolvedThreads"
  >,
  context: ReviewflowRowContext,
): string | null => {
  const parts = [
    checksProgressText(pr, context.bucketKey),
    pr.approvedBy.length === 0
      ? null
      : `approved by ${people(pr.approvedBy, context.viewer)}`,
    pr.unresolvedThreads
      ? pluralOf(pr.unresolvedThreads, "unresolved thread")
      : null,
    awaitedText(pr, context),
  ].filter((part) => part !== null);
  return parts.length === 0 ? null : parts.join(" · ");
};

/**
 * "by @author", "assigned to @a", or both. An author who is their own only
 * assignee is a byline, not an assignment; a pull request whose only person is
 * the viewer names nobody.
 */
export const reviewflowPrOwners = (
  { author, assignees }: Pick<ReviewflowBoardPr, "assignees" | "author">,
  viewer: string | null,
): string | null => {
  const named = [...(author === null ? [] : [author]), ...assignees];
  if (named.length === 0) return null;
  if (viewer !== null && named.every((login) => login === viewer)) return null;

  const byline = author === null ? null : `by ${people([author], viewer)}`;
  if (assignees.length === 0) return byline;
  const assignment = `assigned to ${people(assignees, viewer)}`;

  if (author === null || !assignees.includes(author)) {
    return byline === null ? assignment : `${byline} · ${assignment}`;
  }
  // naming every assignee already names the author among them
  return assignees.length === 1 ? byline : assignment;
};

export const reviewflowPrFlowDate = (
  { openedAt, approvedAt }: Pick<ReviewflowBoardPr, "approvedAt" | "openedAt">,
  options?: FormatRelativeDateOptions,
): string | null => {
  if (approvedAt !== null) {
    return `approved ${formatRelativeDate(approvedAt, options)}`;
  }
  return openedAt === null
    ? null
    : `opened ${formatRelativeDate(openedAt, options)}`;
};

export const formatPrChanges = ({
  changedFiles,
  additions,
  deletions,
}: ReviewflowPrChanges): string =>
  `${pluralOf(changedFiles, "file")} +${String(additions)} −${String(deletions)}`;
