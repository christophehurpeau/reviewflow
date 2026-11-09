import type { PrCheckConclusion, PrReviewState, PrSummary } from "./Pr.ts";

export type PrStateFilter = "closed" | "open";
export type PrDraftFilter = "draft" | "ready";
export type PrChecksFilter = "failed" | "none" | "success";
export type PrReviewFilter = Exclude<PrReviewState, "none">;
/** days without a push, a review or a comment */
export type PrInactiveFilter = "7" | "14" | "30";

/** the filters applied to rows already loaded; the account is a query parameter instead */
export interface PrFilters {
  /** `owner/name` */
  repo?: string;
  author?: string;
  draft?: PrDraftFilter;
  checks?: PrChecksFilter;
  /** in the title or the branch, or the number */
  search?: string;
  review?: PrReviewFilter;
  label?: string;
  inactive?: PrInactiveFilter;
}

export type PrFilterParams = Partial<Record<keyof PrFilters | "state", string>>;

export interface PrFilterOptions {
  repos: string[];
  authors: string[];
  labels: string[];
}

const dayInMs = 24 * 60 * 60 * 1000;

const checksConclusions: Record<PrChecksFilter, PrCheckConclusion> = {
  success: "passed",
  failed: "failed",
  none: "unknown",
};

const isChecksFilter = (value: string): value is PrChecksFilter =>
  Object.hasOwn(checksConclusions, value);

const isDraftFilter = (value: string): value is PrDraftFilter =>
  value === "draft" || value === "ready";

const isReviewFilter = (value: string): value is PrReviewFilter =>
  value === "approved" || value === "changesRequested" || value === "requested";

const isInactiveFilter = (value: string): value is PrInactiveFilter =>
  value === "7" || value === "14" || value === "30";

export const parsePrStateFilter = (value: string | undefined): PrStateFilter =>
  value === "closed" ? "closed" : "open";

/** a value no longer understood is dropped, so a stale link still shows something */
export const parsePrFilters = ({
  repo,
  author,
  draft,
  checks,
  search,
  review,
  label,
  inactive,
}: PrFilterParams): PrFilters => ({
  repo: repo || undefined,
  author: author || undefined,
  draft: draft !== undefined && isDraftFilter(draft) ? draft : undefined,
  checks: checks !== undefined && isChecksFilter(checks) ? checks : undefined,
  search: search || undefined,
  review: review !== undefined && isReviewFilter(review) ? review : undefined,
  label: label || undefined,
  inactive:
    inactive !== undefined && isInactiveFilter(inactive) ? inactive : undefined,
});

export const hasActivePrFilters = ({
  repo,
  author,
  draft,
  checks,
  search,
  review,
  label,
  inactive,
}: PrFilters): boolean =>
  Boolean(
    repo ?? author ?? draft ?? checks ?? search ?? review ?? label ?? inactive,
  );

/** the filters written as url parameters, the defaults left out */
export const toPrFilterParams = (
  state: PrStateFilter,
  { repo, author, draft, checks, search, review, label, inactive }: PrFilters,
): Record<string, string> => ({
  ...(state === "closed" ? { state } : {}),
  ...(repo ? { repo } : {}),
  ...(author ? { author } : {}),
  ...(draft ? { draft } : {}),
  ...(checks ? { checks } : {}),
  ...(search ? { search } : {}),
  ...(review ? { review } : {}),
  ...(label ? { label } : {}),
  ...(inactive ? { inactive } : {}),
});

const matchesSearch = (
  { number, title, headRef }: PrSummary,
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
  { lastActivityAt }: PrSummary,
  days: PrInactiveFilter,
  now: Date,
): boolean =>
  lastActivityAt !== undefined &&
  now.getTime() - lastActivityAt.getTime() >= Number(days) * dayInMs;

export const matchesPrFilters = (
  pr: PrSummary,
  { repo, author, draft, checks, search, review, label, inactive }: PrFilters,
  now: Date = new Date(),
): boolean => {
  if (repo && `${pr.orgLogin}/${pr.repoName}` !== repo) return false;
  if (author && pr.creator?.login !== author) return false;
  if (draft && pr.isDraft !== (draft === "draft")) return false;
  if (checks && pr.checks.conclusion !== checksConclusions[checks]) {
    return false;
  }
  if (search && !matchesSearch(pr, search)) return false;
  if (review && pr.reviewState !== review) return false;
  if (label && !pr.labels.some(({ name }) => name === label)) return false;
  return !inactive || isInactiveFor(pr, inactive, now);
};

const sortedUnique = (values: (string | undefined)[]): string[] =>
  [...new Set(values.filter((value) => value !== undefined))].toSorted((a, b) =>
    a.localeCompare(b),
  );

/** What the loaded rows offer, plus what is selected: it must stay selectable when no row carries it anymore. */
export const buildPrFilterOptions = (
  prs: PrSummary[],
  { repo, author, label }: PrFilters,
): PrFilterOptions => ({
  repos: sortedUnique([
    ...prs.map(({ orgLogin, repoName }) => `${orgLogin}/${repoName}`),
    repo,
  ]),
  authors: sortedUnique([...prs.map(({ creator }) => creator?.login), author]),
  labels: sortedUnique([
    ...prs.flatMap(({ labels }) => labels.map(({ name }) => name)),
    label,
  ]),
});

/** A repository of another account can only match nothing. */
export const prFiltersForAccount = (
  filters: PrFilters,
  accountLogin: string | undefined,
): PrFilters =>
  accountLogin === undefined || filters.repo?.startsWith(`${accountLogin}/`)
    ? filters
    : { ...filters, repo: undefined };
