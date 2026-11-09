import type {
  ReviewflowChecksConclusion,
  ReviewflowReviewState,
} from "../types/reviewflow.ts";
import type { ReviewflowBoardPr } from "./board.ts";
import { accountOfOwnerRepo } from "./board.ts";

export type BoardStateFilter = "closed" | "open";
export type BoardDraftFilter = "draft" | "ready";
export type BoardChecksFilter = "failed" | "none" | "success";
export type BoardReviewFilter = Exclude<ReviewflowReviewState, "none">;
/** days without a push, a review or a comment */
export type BoardInactiveFilter = "7" | "14" | "30";

export interface BoardFilters {
  state: BoardStateFilter;
  account: string | null;
  /** `owner/name` */
  repo: string | null;
  author: string | null;
  draft: BoardDraftFilter | null;
  checks: BoardChecksFilter | null;
  /** in the title or the branch, or the number */
  search: string | null;
  review: BoardReviewFilter | null;
  label: string | null;
  inactive: BoardInactiveFilter | null;
}

export const defaultBoardFilters: BoardFilters = {
  state: "open",
  account: null,
  repo: null,
  author: null,
  draft: null,
  checks: null,
  search: null,
  review: null,
  label: null,
  inactive: null,
};

export type BoardFilterParams = Partial<Record<keyof BoardFilters, string>>;

export interface BoardFilterOptions {
  repos: string[];
  authors: string[];
  labels: string[];
}

const dayInMs = 24 * 60 * 60 * 1000;

const checksConclusions: Record<BoardChecksFilter, ReviewflowChecksConclusion> =
  {
    success: "passed",
    failed: "failed",
    none: "unknown",
  };

const isChecksFilter = (value: string): value is BoardChecksFilter =>
  Object.hasOwn(checksConclusions, value);

const isDraftFilter = (value: string): value is BoardDraftFilter =>
  value === "draft" || value === "ready";

const isReviewFilter = (value: string): value is BoardReviewFilter =>
  value === "approved" || value === "changesRequested" || value === "requested";

const isInactiveFilter = (value: string): value is BoardInactiveFilter =>
  value === "7" || value === "14" || value === "30";

/** a value no longer understood is dropped, so a stale link still shows something */
export const parseBoardFilters = ({
  state,
  account,
  repo,
  author,
  draft,
  checks,
  search,
  review,
  label,
  inactive,
}: BoardFilterParams): BoardFilters => ({
  state: state === "closed" ? "closed" : "open",
  account: account || null,
  repo: repo || null,
  author: author || null,
  draft: draft !== undefined && isDraftFilter(draft) ? draft : null,
  checks: checks !== undefined && isChecksFilter(checks) ? checks : null,
  search: search || null,
  review: review !== undefined && isReviewFilter(review) ? review : null,
  label: label || null,
  inactive:
    inactive !== undefined && isInactiveFilter(inactive) ? inactive : null,
});

/** the filters written as url parameters, the defaults left out */
export const toBoardFilterParams = ({
  state,
  ...narrowing
}: BoardFilters): Record<string, string> => ({
  ...(state === "closed" ? { state } : {}),
  ...Object.fromEntries(
    Object.entries(narrowing).filter(([, value]) => value !== null),
  ),
});

/** every filter but the open/closed view, which is where the user stands rather than a narrowing */
export const hasActiveBoardFilters = ({
  state: _state,
  ...narrowing
}: BoardFilters): boolean =>
  Object.values(narrowing).some((value) => value !== null);

const matchesSearch = (
  { number, title, headRef }: ReviewflowBoardPr,
  search: string,
): boolean => {
  const query = search.toLowerCase();
  return (
    query.replace(/^#/, "") === String(number) ||
    title.toLowerCase().includes(query) ||
    (headRef?.toLowerCase().includes(query) ?? false)
  );
};

const isInactiveFor = (
  { lastActivityAt }: ReviewflowBoardPr,
  days: BoardInactiveFilter,
  now: Date,
): boolean =>
  now.getTime() - new Date(lastActivityAt).getTime() >= Number(days) * dayInMs;

export const matchesBoardFilters = (
  pr: ReviewflowBoardPr,
  {
    account,
    repo,
    author,
    draft,
    checks,
    search,
    review,
    label,
    inactive,
  }: BoardFilters,
  now: Date = new Date(),
): boolean => {
  if (
    account !== null &&
    accountOfOwnerRepo(pr.ownerRepo) !== account.toLowerCase()
  ) {
    return false;
  }
  if (repo !== null && pr.ownerRepo.toLowerCase() !== repo.toLowerCase()) {
    return false;
  }
  if (author !== null && pr.author !== author) return false;
  if (draft !== null && (pr.state === "draft") !== (draft === "draft")) {
    return false;
  }
  if (checks !== null && pr.checksConclusion !== checksConclusions[checks]) {
    return false;
  }
  if (search !== null && !matchesSearch(pr, search)) return false;
  if (review !== null && pr.reviewState !== review) return false;
  if (label !== null && !pr.labels.includes(label)) return false;
  return inactive === null || isInactiveFor(pr, inactive, now);
};

const sortedUnique = (values: (string | null)[]): string[] =>
  [...new Set(values.filter((value) => value !== null))].toSorted((a, b) =>
    a.localeCompare(b),
  );

/**
 * What the rows offer, narrowed to the selected account, plus what is selected:
 * it must stay selectable when no row carries it anymore.
 */
export const buildBoardFilterOptions = (
  prs: ReviewflowBoardPr[],
  { account, repo, author, label }: BoardFilters,
): BoardFilterOptions => {
  const accountPrs =
    account === null
      ? prs
      : prs.filter(
          ({ ownerRepo }) =>
            accountOfOwnerRepo(ownerRepo) === account.toLowerCase(),
        );
  return {
    repos: sortedUnique([
      ...accountPrs.map(({ ownerRepo }) => ownerRepo),
      repo,
    ]),
    authors: sortedUnique([...accountPrs.map((pr) => pr.author), author]),
    labels: sortedUnique([...accountPrs.flatMap((pr) => pr.labels), label]),
  };
};

/** Selects an account; a repository of another one could only match nothing. */
export const withBoardFilterAccount = (
  filters: BoardFilters,
  account: string | null,
): BoardFilters => ({
  ...filters,
  account,
  repo:
    account === null ||
    (filters.repo !== null &&
      accountOfOwnerRepo(filters.repo) === account.toLowerCase())
      ? filters.repo
      : null,
});
