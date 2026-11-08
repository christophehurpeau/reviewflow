import type { ReviewflowBoardPr } from "../reviewflow/board.ts";
import type {
  PrMergeable,
  PrReviewDecision,
  PrState,
} from "../types/entities.ts";
import type { ReviewflowReviewState } from "../types/reviewflow.ts";

/**
 * What the operator is told about a pull request, in one word or two.
 *
 * `pr.state` and `pr.reviewDecision` are two columns because GitHub reports two
 * fields, but they are never two answers: an open PR is only ever interesting
 * for where its review stands, and "open" on its own says nothing the branch did
 * not already say. So the two collapse into one status, and every surface
 * reads it from here rather than
 * formatting the columns itself. They had drifted into three different renderings
 * of the same row.
 *
 * `noReviewers` and `waitingReview` are a real distinction, not a null check:
 * GitHub leaves `reviewDecision` null when nothing is required and nobody was
 * asked, and answers `REVIEW_REQUIRED` when a review is required and missing.
 * The first is the operator's own omission — nobody is coming — and the second
 * is somebody else's turn.
 */
export const prStatuses = [
  "approved",
  "changesRequested",
  "closed",
  "draft",
  "merged",
  "noReviewers",
  "waitingReview",
] as const;

export type PrStatus = (typeof prStatuses)[number];

const reviewStatuses: Record<
  NonNullable<PrReviewDecision>,
  Extract<PrStatus, "approved" | "changesRequested" | "waitingReview">
> = {
  approved: "approved",
  changesRequested: "changesRequested",
  reviewRequired: "waitingReview",
};

/**
 * A closed or merged PR keeps its own status whatever the last review said: an
 * approved PR that was closed is closed, and saying "approved" would describe a
 * decision nobody is going to act on.
 */
export const prStatus = ({
  state,
  reviewDecision,
}: {
  state: PrState;
  reviewDecision: PrReviewDecision;
}): PrStatus => {
  if (state !== "open") return state;
  return reviewDecision === null
    ? "noReviewers"
    : reviewStatuses[reviewDecision];
};

export const prStatusLabels: Record<PrStatus, string> = {
  approved: "approved",
  changesRequested: "changes requested",
  closed: "closed",
  draft: "draft",
  merged: "merged",
  noReviewers: "no reviewers",
  waitingReview: "waiting review",
};

/**
 * Only while it can still be merged: GitHub keeps answering for a closed one,
 * and a conflict nobody will resolve is not something to look at.
 */
export const prHasConflicts = ({
  state,
  mergeable,
}: {
  state: PrState;
  mergeable: PrMergeable;
}): boolean =>
  (state === "open" || state === "draft") && mergeable === "conflicting";

/**
 * Built rather than stored: the number and `owner/repo` are kept apart,
 * and a url column would be a third copy of both that goes stale when either
 * moves. GitHub redirects `/pull/<n>` to the right kind of page, so nothing here
 * has to know whether the number belongs to a PR or an issue.
 */
export const prUrl = (ownerRepo: string, number: number): string =>
  `https://github.com/${ownerRepo}/pull/${String(number)}`;

const prNumberPattern = /^#?(\d+)$/;
const prUrlPattern =
  /^https?:\/\/github\.com\/([^/\s]+\/[^/\s]+)\/pull\/(\d+)(?:[/?#]\S*)?$/i;

/**
 * A pull request of `ownerRepo` as the operator names one — `123`, `#123` or
 * its GitHub url, a tab of it included — or why the text names none. A url of
 * another repository is refused rather than reduced to its number, which would
 * name a different pull request.
 */
export const prNumberOf = (
  input: string,
  ownerRepo: string,
): number | string => {
  const text = input.trim();
  const url = prUrlPattern.exec(text);
  const [, digits] = url === null ? (prNumberPattern.exec(text) ?? []) : [];
  if (url !== null && url[1]?.toLowerCase() !== ownerRepo.toLowerCase()) {
    return `that pull request is not in ${ownerRepo}`;
  }
  const number = Number(url?.[2] ?? digits);
  if (!Number.isInteger(number) || number < 1) {
    return "a pull request number or its GitHub link is expected";
  }
  return number;
};

/**
 * reviewflow's review state in GitHub's vocabulary, which `pr` stores. `none` is
 * what GitHub cannot say on a repository that requires a review: it answers
 * `REVIEW_REQUIRED` whether or not anyone was asked, where reviewflow tells the
 * two apart.
 */
export const reviewflowReviewDecisions: Record<
  ReviewflowReviewState,
  PrReviewDecision
> = {
  approved: "approved",
  changesRequested: "changesRequested",
  requested: "reviewRequired",
  none: null,
};

/** null when reviewflow does not know enough to say */
export const reviewflowPrStatus = ({
  state,
  reviewState,
}: Pick<ReviewflowBoardPr, "reviewState" | "state">): PrStatus | null => {
  if (state === null) return null;
  if (state !== "open") return state;
  if (reviewState === null) return null;
  return prStatus({
    state,
    reviewDecision: reviewflowReviewDecisions[reviewState],
  });
};
