import type {
  PrChangesSummary,
  PrChecksSummary,
  PrSummary,
  PrUserSummary,
} from "./Pr.ts";
import { splitFailedCheckNames } from "./formatFailedCheckNames.ts";

/**
 * Someone else's pull request requests a review, your own waits for one, so the
 * section the row sits in decides the verb.
 */
export type ReviewRequestVerb = "awaiting" | "requested";

/**
 * A section title already states the bucket every row in it belongs to, so a row
 * repeats neither the draft state nor a green build where that is the point of
 * the section.
 */
export interface PrRowDisplayOptions {
  /** rendered as the viewer rather than as one more login */
  currentUserLogin?: string;
  /** how the viewer is named; slack italicises it */
  selfLabel?: string;
  showDraft?: boolean;
  showPassedChecks?: boolean;
  /**
   * Whether the reviewers asked again join the ones awaited; off where the
   * section title already says every row in it was asked again.
   */
  showReRequests?: boolean;
  reviewRequestVerb?: ReviewRequestVerb;
  /** slack renders a check name as code, the webapp renders it plain */
  wrapCheckName?: (name: string) => string;
}

/**
 * The four slots a row states about a pull request, each carrying its own
 * emphasis: the webapp gives the first two an accent, slack bolds the first.
 */
export interface PrRowStatus {
  failed: string;
  changesRequested: string | undefined;
  isDraft: boolean;
  rest: string;
}

const pluralize = (count: number, word: string): string =>
  `${count} ${word}${count > 1 ? "s" : ""}`;

export const joinSegments = (segments: (string | undefined)[]): string =>
  segments.filter((segment) => segment !== undefined).join(" · ");

/**
 * The file count and the diff read as one segment of a `·` separated line, so
 * they cannot be separated by a `·` of their own.
 */
export const formatPrChanges = ({
  changedFiles,
  additions,
  deletions,
}: PrChangesSummary): string =>
  `${pluralize(changedFiles, "file")} (+${additions} −${deletions})`;

export const formatPrFlowDate = ({
  approvedAt,
  openedAt,
}: Pick<PrSummary, "approvedAt" | "openedAt">): string | undefined => {
  const date = approvedAt ?? openedAt;
  if (!date) return undefined;

  return `${approvedAt ? "approved" : "opened"} ${date.toLocaleDateString(
    "en-US",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    },
  )}`;
};

interface FormatLoginsOptions {
  currentUserLogin: string | undefined;
  selfLabel: string;
}

const formatLogins = (
  users: PrUserSummary[],
  { currentUserLogin, selfLabel }: FormatLoginsOptions,
): string =>
  users
    .map(({ login }) => (login === currentUserLogin ? selfLabel : `@${login}`))
    .join(", ");

const formatFailedNames = (
  failedNames: string[],
  wrapCheckName: (name: string) => string,
): string => {
  const { names, remaining } = splitFailedCheckNames(failedNames);
  const listed = names.map(wrapCheckName).join(", ");
  return `${failedNames.length > 1 ? "checks" : "check"} failed: ${listed}${
    remaining > 0 ? ` +${remaining}` : ""
  }`;
};

/**
 * A pull request without any check reports nothing, and a green one only where
 * the section it sits under does not already imply it.
 */
const formatChecks = (
  { conclusion, runningCount }: PrChecksSummary,
  showPassedChecks: boolean,
): string | undefined => {
  if (conclusion === "in-progress") {
    return `${pluralize(runningCount, "check")} running`;
  }
  if (conclusion === "passed" && showPassedChecks) return "checks passed";
  return undefined;
};

interface FormatReviewRequestsOptions extends FormatLoginsOptions {
  verb: ReviewRequestVerb;
  showReRequests: boolean;
}

/**
 * Everyone the review still waits on, whether they were asked once or asked
 * again: the row states who is expected, and the distinction only matters to
 * the section a pull request is filed under.
 */
const formatReviewRequests = (
  { requestedReviewers, reRequestedReviewers, requestedTeams }: PrSummary,
  { verb, showReRequests, ...loginsOptions }: FormatReviewRequestsOptions,
): string | undefined => {
  const reviewers = [
    ...requestedReviewers,
    ...(showReRequests ? reRequestedReviewers : []),
  ];
  if (reviewers.length === 0 && requestedTeams.length === 0) return undefined;

  return `${verb} ${[
    formatLogins(reviewers, loginsOptions),
    ...requestedTeams.map((team) => `#${team}`),
  ]
    .filter(Boolean)
    .join(", ")}`;
};

export const selectPrRowStatus = (
  pr: PrSummary,
  {
    currentUserLogin,
    selfLabel = "you",
    showDraft = true,
    showPassedChecks = true,
    showReRequests = true,
    reviewRequestVerb = "awaiting",
    wrapCheckName = (name) => name,
  }: PrRowDisplayOptions = {},
): PrRowStatus => {
  const loginsOptions: FormatLoginsOptions = { currentUserLogin, selfLabel };

  return {
    failed: joinSegments([
      pr.checks.failedNames.length > 0
        ? formatFailedNames(pr.checks.failedNames, wrapCheckName)
        : undefined,
      pr.lintFailed ? "pr lint failed" : undefined,
    ]),
    changesRequested:
      pr.changesRequestedBy.length > 0
        ? `changes requested by ${formatLogins(pr.changesRequestedBy, loginsOptions)}`
        : undefined,
    isDraft: showDraft && pr.isDraft,
    rest: joinSegments([
      formatChecks(pr.checks, showPassedChecks),
      pr.approvedBy.length > 0
        ? `approved by ${formatLogins(pr.approvedBy, loginsOptions)}`
        : undefined,
      formatReviewRequests(pr, {
        ...loginsOptions,
        verb: reviewRequestVerb,
        showReRequests,
      }),
    ]),
  };
};
