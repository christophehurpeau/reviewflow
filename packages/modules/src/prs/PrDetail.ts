import type { PrBucket, PrChecksSummary, PrSummary } from "./Pr.ts";

/** `null` when reviewflow cannot know it, never a guess */
export type PrState = "closed" | "draft" | "merged" | "open";

export type PrReviewState =
  | "approved"
  | "changesRequested"
  | "none"
  | "requested";

export type PrReviewerState =
  | "approved"
  | "changesRequested"
  | "commented"
  | "dismissed"
  | "requested"
  | "reRequested";

export interface PrReviewer {
  id: number;
  login: string;
  state: PrReviewerState;
  /** their last review of any kind */
  submittedAt: string | null;
  /** when reviewflow received the pending request */
  requestedAt: string | null;
}

export interface PrDetailChecks extends PrChecksSummary {
  passed: number;
  /** after the account's checks allowed to fail and the `/hold-` rule */
  failed: number;
  /** codecov and `/hold-` checks left out, as reviewflow ignores them */
  pending: number;
  /** github was read 100 checks at a time: past that, some may be missing */
  truncated: boolean;
}

/**
 * One pull request as the read api returns it: dates are ISO 8601 strings in
 * UTC, and a field reviewflow cannot know for an old document is `null`.
 * Everything but `myBuckets` is the same for every reader.
 */
export interface PrDetail extends Omit<
  PrSummary,
  "approvedAt" | "checks" | "openedAt"
> {
  accountId: number;
  repoId: number;
  /** "owner/name" */
  ownerRepo: string;
  githubNodeId: string | null;

  headRef: string | null;
  baseRef: string | null;
  headSha: string | null;
  /** `owner/name` of the head branch, a fork for fork pull requests */
  headRepoFullName: string | null;

  state: PrState | null;
  mergeable: "conflicting" | "mergeable" | "unknown";

  flowDates: {
    createdAt: string | null;
    openedAt: string | null;
    readyAt: string | null;
    reviewStartedAt: string | null;
    approvedAt: string | null;
    closedAt: string | null;
    lastPushedAt: string | null;
    lastReviewSubmittedAt: string | null;
  };

  reviewState: PrReviewState | null;
  /** people asked or having reviewed, the author excluded; teams are in `requestedTeams` */
  reviewers: PrReviewer[];
  unresolvedThreads: number | null;

  checks: PrDetailChecks;

  /** where it sits on the caller's board, in board order; empty when on none */
  myBuckets: PrBucket[];

  /** last reviewflow write */
  updatedAt: string;
}
