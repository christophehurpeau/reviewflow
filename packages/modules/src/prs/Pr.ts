export type PrBucket =
  | "changes-requested"
  | "drafts"
  | "no-action-planned"
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
  failedCount: number;
  runningCount: number;
  /** the names of the failed checks, to tell which job broke without opening github */
  failedNames: string[];
}

export interface PrChangesSummary {
  changedFiles: number;
  additions: number;
  deletions: number;
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
  approvedCount: number;
  changesRequestedCount: number;
  requestedReviewers: PrUserSummary[];
  requestedTeams: string[];
  assignees: PrUserSummary[];
  creator?: PrUserSummary;
  changes?: PrChangesSummary;
  openedAt?: Date;
}
