export type PrBucket =
  | "changes-requested"
  | "drafts"
  | "opened-missing-review-request"
  | "re-requested-reviews"
  | "ready-to-merge"
  | "requested-reviews"
  | "waiting-for-review";

export type PrCheckConclusion = "failed" | "in-progress" | "passed" | "unknown";

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
  isDraft: boolean;
  checks: PrChecksSummary;
  /** reviewflow's own pull request lint (title, commits), failing independently of the checks */
  lintFailed: boolean;
  statusLinks: PrStatusLink[];
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
  openedAt?: Date;
  approvedAt?: Date;
}
