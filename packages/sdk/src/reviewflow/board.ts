import type { PullRequestRef } from "../api/pullRequest.ts";
import type { PrState } from "../types/entities.ts";
import type {
  ReviewflowChecksConclusion,
  ReviewflowMergeable,
  ReviewflowPrChanges,
  ReviewflowReviewState,
  ReviewflowStatusLink,
} from "../types/reviewflow.ts";
import type {
  ReviewflowClient,
  ReviewflowGroup,
  ReviewflowPrDetail,
} from "./client.ts";
import type { ReviewflowStreamEvent } from "./stream.ts";

/**
 * The pull requests board, assembled from what the reviewflow client answers.
 * Pure functions over plain data: a caller keeps the snapshot wherever it
 * likes (memory, a database) and turns it into the answer with `assembleBoard`.
 */

/**
 * One pull request of the board, as reviewflow computed it. `null` is
 * reviewflow not knowing, shown as unknown, never guessed.
 */
export interface ReviewflowBoardPr {
  /** reviewflow's id */
  id: string;
  ownerRepo: string;
  number: number;
  title: string;
  url: string;
  headRef: string | null;
  state: PrState | null;
  reviewState: ReviewflowReviewState | null;
  author: string | null;
  checksFailed: number;
  checksConclusion: ReviewflowChecksConclusion;
  checksRunning: number;
  /** after reviewflow's allowed-to-fail rules, so possibly fewer than `checksFailed` */
  failedChecks: string[];
  lintFailed: boolean;
  approvedBy: string[];
  changesRequestedBy: string[];
  /** asked for the first time */
  requestedReviewers: string[];
  /** asked again after having reviewed */
  reRequestedReviewers: string[];
  requestedTeams: string[];
  assignees: string[];
  statusLinks: ReviewflowStatusLink[];
  changes: ReviewflowPrChanges | null;
  openedAt: string | null;
  approvedAt: string | null;
  /** can outlive a reopening: only meaningful with a closed or merged `state` */
  closedAt: string | null;
  labels: string[];
  /** the last push, review or comment, reviewflow's last write when it cannot tell */
  lastActivityAt: string;
  unresolvedThreads: number | null;
  mergeable: ReviewflowMergeable;
  /** reviewflow's last write */
  updatedAt: string;
}

/**
 * Keys and titles are reviewflow's, kept as strings: a bucket it adds later is
 * rendered without a release.
 */
export interface ReviewflowBoardBucket {
  key: string;
  title: string;
  /** the bucket's size in reviewflow, accounts added up; `prs` stops at the pages read */
  total: number;
  /** in the bucket's own order */
  prs: ReviewflowBoardPr[];
}

export interface ReviewflowBoardGroup {
  key: string;
  title: string;
  buckets: ReviewflowBoardBucket[];
}

/**
 * `GET /api/reviewflow/board`, and the data of a `board` event: the boards of
 * every account read, bucket by bucket with their totals added up; `board` is
 * null before any account was read.
 */
export interface ReviewflowBoardResponse {
  board: { fetchedAt: string; groups: ReviewflowBoardGroup[] } | null;
  /** the token's GitHub login, named "you" on the board */
  viewer: string | null;
}

/** `GET /api/reviewflow/closed`: empty without a token */
export interface ReviewflowClosedPullRequestsResponse {
  /** every match in reviewflow; `prs` stops at the first page */
  total: number;
  prs: ReviewflowBoardPr[];
  viewer: string | null;
}

export const toBoardPr = (pr: ReviewflowPrDetail): ReviewflowBoardPr => ({
  id: pr.id,
  ownerRepo: pr.ownerRepo,
  number: pr.number,
  title: pr.title,
  url: pr.url,
  headRef: pr.headRef,
  state: pr.state,
  reviewState: pr.reviewState,
  author: pr.author,
  checksFailed: pr.checks.failed,
  checksConclusion: pr.checks.conclusion,
  checksRunning: pr.checks.running,
  failedChecks: pr.checks.failedNames,
  lintFailed: pr.lintFailed,
  approvedBy: pr.approvedBy,
  changesRequestedBy: pr.changesRequestedBy,
  requestedReviewers: pr.requestedReviewers,
  reRequestedReviewers: pr.reRequestedReviewers,
  requestedTeams: pr.requestedTeams,
  assignees: pr.assignees,
  statusLinks: pr.statusLinks,
  changes: pr.changes,
  openedAt: pr.openedAt,
  approvedAt: pr.approvedAt,
  closedAt: pr.closedAt,
  labels: pr.labels,
  lastActivityAt: pr.lastActivityAt ?? pr.updatedAt,
  unresolvedThreads: pr.unresolvedThreads,
  mergeable: pr.mergeable,
  updatedAt: pr.updatedAt,
});

export interface AccountBoard {
  groups: ReviewflowGroup[];
  /** ISO date of the read */
  fetchedAt: string;
}

/** each account's last read, keyed by the account as the caller spells it */
export type ReviewflowBoardSnapshot = Record<string, AccountBoard>;

/** the account (owner) a pull request belongs to, lowercased */
export const accountOfOwnerRepo = (ownerRepo: string): string =>
  ownerRepo.slice(0, ownerRepo.indexOf("/")).toLowerCase();

export const isPullRequestOnBoard = (
  board: ReviewflowBoardResponse["board"],
  { ownerRepo, number }: PullRequestRef,
): boolean => {
  const wanted = ownerRepo.toLowerCase();
  return (
    board?.groups.some((group) =>
      group.buckets.some((bucket) =>
        bucket.prs.some(
          (pr) => pr.number === number && pr.ownerRepo.toLowerCase() === wanted,
        ),
      ),
    ) ?? false
  );
};

/** Replaces one account's read; the other accounts' are left as they are. */
export const withAccountBoard = (
  snapshot: ReviewflowBoardSnapshot,
  account: string,
  board: AccountBoard,
): ReviewflowBoardSnapshot => ({ ...snapshot, [account]: board });

export interface AccountBoardRead {
  boards: { account: string; groups: ReviewflowGroup[] }[];
  /** an account that failed alone: the others still count */
  errors: { account: string; message: string }[];
}

/**
 * Reads each account's board (the client follows the extra pages past the
 * first 100 of a bucket). One account the token cannot read fails alone.
 */
export const readAccountBoards = async (
  client: Pick<ReviewflowClient, "board">,
  accounts: string[],
): Promise<AccountBoardRead> => {
  const settled = await Promise.allSettled(
    accounts.map(async (account) => ({
      account,
      groups: await client.board(account),
    })),
  );
  const read: AccountBoardRead = { boards: [], errors: [] };
  settled.forEach((result, index) => {
    if (result.status === "fulfilled") read.boards.push(result.value);
    else {
      const { reason } = result;
      read.errors.push({
        account: accounts[index]!,
        message: reason instanceof Error ? reason.message : String(reason),
      });
    }
  });
  return read;
};

interface Flat {
  key: string;
  group: { key: string; title: string };
  title: string;
  total: number;
  position: number;
  prs: ReviewflowBoardPr[];
  fetchedAt: string;
}

/**
 * One bucket per key across the accounts, totals added up: the board is its
 * accounts' boards side by side. `fetchedAt` is the oldest read, the one the
 * age shown has to answer for. Null when no account was read.
 */
export const assembleBoard = (
  snapshot: ReviewflowBoardSnapshot,
  viewer: string | null,
  accounts: string[] = Object.keys(snapshot),
): ReviewflowBoardResponse => {
  const merged = new Map<string, Flat>();
  const fetchedAts: string[] = [];
  for (const account of accounts) {
    const read = snapshot[account];
    if (read === undefined) continue;
    fetchedAts.push(read.fetchedAt);
    let position = 0;
    for (const group of read.groups) {
      for (const bucket of group.buckets) {
        const existing = merged.get(bucket.key);
        const prs = bucket.prs.map((pr) => toBoardPr(pr));
        if (existing === undefined) {
          merged.set(bucket.key, {
            key: bucket.key,
            group: { key: group.key, title: group.title },
            title: bucket.title,
            total: bucket.total,
            position,
            prs,
            fetchedAt: read.fetchedAt,
          });
        } else {
          existing.total += bucket.total;
          existing.position = Math.min(existing.position, position);
          const seen = new Set(existing.prs.map((pr) => pr.id));
          existing.prs.push(...prs.filter((pr) => !seen.has(pr.id)));
        }
        position++;
      }
    }
  }
  if (merged.size === 0) return { board: null, viewer };

  const groups: ReviewflowBoardGroup[] = [];
  for (const bucket of [...merged.values()].toSorted(
    (a, b) => a.position - b.position,
  )) {
    const entry: ReviewflowBoardBucket = {
      key: bucket.key,
      title: bucket.title,
      total: bucket.total,
      prs: bucket.prs,
    };
    const last = groups.at(-1);
    if (last?.key === bucket.group.key) last.buckets.push(entry);
    else {
      groups.push({
        key: bucket.group.key,
        title: bucket.group.title,
        buckets: [entry],
      });
    }
  }
  const [oldest] = fetchedAts.toSorted((a, b) => a.localeCompare(b));
  return { board: { fetchedAt: oldest ?? "", groups }, viewer };
};

export interface AppliedStreamEvent {
  snapshot: ReviewflowBoardSnapshot;
  /** a row of the snapshot was replaced or removed */
  changed: boolean;
  /**
   * The accounts to read again. The board is not rebuilt from events: its
   * buckets are sorted on fields the stream does not carry, so a pull request
   * that may have changed bucket, entered the scope or left it is the signal to
   * read the account again.
   */
  readAccounts: string[];
}

/**
 * Applies a `pr` or `prRemoved` stream event to the snapshot: a row already on
 * the board is replaced in place (or dropped, its bucket's total one lower),
 * and the account is flagged for a fresh read. Any other event changes nothing.
 */
export const applyStreamEvent = (
  snapshot: ReviewflowBoardSnapshot,
  event: ReviewflowStreamEvent,
): AppliedStreamEvent => {
  if (event.type !== "pr" && event.type !== "prRemoved") {
    return { snapshot, changed: false, readAccounts: [] };
  }
  const id = event.type === "pr" ? event.pr.id : event.id;
  let changed = false;
  const holding = new Set<string>();
  const next: ReviewflowBoardSnapshot = {};
  for (const [account, read] of Object.entries(snapshot)) {
    // oxlint-disable-next-line eslint/no-loop-func
    const groups = read.groups.map((group) => ({
      ...group,
      buckets: group.buckets.map((bucket) => {
        if (!bucket.prs.some((pr) => pr.id === id)) return bucket;
        holding.add(account);
        changed = true;
        if (event.type === "pr") {
          return {
            ...bucket,
            prs: bucket.prs.map((pr) => (pr.id === id ? event.pr : pr)),
          };
        }
        return {
          ...bucket,
          total: Math.max(0, bucket.total - 1),
          prs: bucket.prs.filter((pr) => pr.id !== id),
        };
      }),
    }));
    next[account] = { ...read, groups };
  }
  const readAccounts = new Set(holding);
  if (event.type === "pr") {
    const owner = accountOfOwnerRepo(event.pr.ownerRepo);
    for (const account of Object.keys(snapshot)) {
      if (account.toLowerCase() === owner) readAccounts.add(account);
    }
  }
  return {
    snapshot: changed ? next : snapshot,
    changed,
    readAccounts: [...readAccounts],
  };
};
