export type ReviewflowReviewState =
  | "approved"
  | "changesRequested"
  | "none"
  | "requested";

export type ReviewflowMergeable = "conflicting" | "mergeable" | "unknown";

/** `unknown` is a pull request with no check at all */
export type ReviewflowChecksConclusion =
  | "failed"
  | "inProgress"
  | "passed"
  | "unknown";

/** a link reviewflow resolved on the pull request, a ticket key among them */
export interface ReviewflowStatusLink {
  name: string;
  label: string;
  url: string;
}

export interface ReviewflowPrChanges {
  changedFiles: number;
  additions: number;
  deletions: number;
}

export interface ReviewflowAccount {
  login: string;
  type: "Organization" | "User";
}
