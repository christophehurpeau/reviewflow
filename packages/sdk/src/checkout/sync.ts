import type { IsoDateTime } from "../types/ids.ts";

/** The commit a checkout has out, as its status line shows it. */
export interface CheckoutHeadCommit {
  shortSha: string;
  subject: string;
  committedAt: IsoDateTime;
}

/**
 * What git says about one checkout, read fresh on every request. Ahead and
 * behind are against the remote-tracking ref as of the last fetch.
 */
export interface CheckoutStatus {
  path: string;
  /** null on a detached HEAD */
  branch: string | null;
  /** null on a branch with no commit yet */
  commit: CheckoutHeadCommit | null;
  /** e.g. `origin/main`; null when the branch tracks nothing */
  upstream: string | null;
  /** null without an upstream, or when the upstream's ref no longer exists */
  ahead: number | null;
  behind: number | null;
  modified: number;
  untracked: number;
}

/** A checkout's status, for a surface offering Pull and Push on it. */
export interface CheckoutSyncResponse {
  status: CheckoutStatus;
  /** whether a branch with no upstream can be published to `origin` */
  hasOrigin: boolean;
  /** the fetch failed; the status is then as of the previous one */
  fetchError: string | null;
}

/**
 * An upstream git still names but whose ref the last fetch pruned — GitHub
 * deletes a merged head branch. Pushing would bring a merged branch back, so it
 * is refused rather than treated as "no upstream" and published again.
 */
const upstreamGone = (upstream: string): string =>
  `${upstream} no longer exists on the remote`;

/**
 * Why a pull would be refused, or null when it is offered. A surface shows the
 * button only on null and the server throws the same sentence before running
 * git, so the two cannot disagree on what "applicable" means.
 *
 * `behind` is as of the last fetch: a checkout reading 0 may still have
 * something to pull, which is why a surface fetches before reading.
 */
export const pullRefusal = (status: CheckoutStatus): string | null => {
  if (status.branch === null) return "a detached HEAD has nothing to pull into";
  if (status.upstream === null) {
    return `${status.branch} tracks no remote branch`;
  }
  if (status.behind === null) return upstreamGone(status.upstream);
  if (status.behind === 0) {
    return `${status.branch} is not behind ${status.upstream}`;
  }
  return null;
};

/**
 * A branch with no upstream is published to `origin` rather than refused, so a
 * new branch reaches GitHub from the same place. Diverged branches are offered
 * too: git refuses the non-fast-forward itself, and its reason is what the
 * user reads.
 */
export const pushRefusal = (
  status: CheckoutStatus,
  hasOrigin: boolean,
): string | null => {
  if (status.branch === null) return "a detached HEAD has no branch to push";
  if (status.upstream === null) {
    return hasOrigin ? null : "this repository has no origin remote";
  }
  if (status.ahead === null) return upstreamGone(status.upstream);
  if (status.ahead === 0) {
    return `${status.branch} has nothing to push to ${status.upstream}`;
  }
  return null;
};
