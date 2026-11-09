export type PrBucket =
  | "changes-requested"
  | "drafts"
  | "opened-missing-review-request"
  | "re-requested-reviews"
  | "ready-to-merge"
  | "requested-reviews"
  | "waiting-for-review";

/** what `queryMyPrs` lists: a bucket of the board, or the closed pull requests */
export type MyPrsList = PrBucket | "closed";

export type PrCheckConclusion = "failed" | "in-progress" | "passed" | "unknown";

export type PrReviewState =
  | "approved"
  | "changesRequested"
  | "none"
  | "requested";

export interface PrLabel {
  id: number;
  name: string;
}

export interface PrUserSummary {
  id: number;
  login: string;
  avatarUrl?: string;
}

export interface PrChecksSummary {
  conclusion: PrCheckConclusion;
  runningCount: number;
  /** the names of the failed checks, to tell which job broke without opening github */
  failedNames: string[];
}

export interface PrChangesSummary {
  changedFiles: number;
  additions: number;
  deletions: number;
}

/**
 * A reviewflow status that carries a url, surfaced as a link next to the pull
 * request. A notion ticket and a jira issue are the two account configs produce
 * today, but nothing here knows about either.
 */
export interface PrStatusLink {
  /** the reviewflow status name, which is the account config rule's `status` key */
  name: string;
  label: string;
  url: string;
  type: "failure" | "pending" | "success";
}

export interface PrSummary {
  _id: string;
  orgLogin: string;
  repoName: string;
  number: number;
  title: string;
  url: string;
  headRef: string | null;
  isDraft: boolean;
  checks: PrChecksSummary;
  /** reviewflow's own pull request lint (title, commits), failing independently of the checks */
  lintFailed: boolean;
  statusLinks: PrStatusLink[];
  labels: PrLabel[];
  /** `null` when reviewflow cannot know it */
  reviewState: PrReviewState | null;
  approvedBy: PrUserSummary[];
  changesRequestedBy: PrUserSummary[];
  /** asked for a review they have not given on this pull request before */
  requestedReviewers: PrUserSummary[];
  /** asked again, having already reviewed this pull request */
  reRequestedReviewers: PrUserSummary[];
  requestedTeams: string[];
  assignees: PrUserSummary[];
  creator?: PrUserSummary;
  changes?: PrChangesSummary;
  /** `null` until reviewflow has read the review threads once */
  unresolvedThreads: number | null;
  openedAt?: Date;
  approvedAt?: Date;
  /** set on a closed pull request only: a reopened one keeps its old date in mongo */
  closedAt?: Date;
  /** absent on a pull request closed before reviewflow recorded merges */
  isMerged?: boolean;
}
