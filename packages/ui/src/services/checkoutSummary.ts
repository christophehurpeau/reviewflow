import type { CheckoutBranch, CheckoutStatus } from "@reviewflow/sdk";

const trackParts = (ahead: number | null, behind: number | null): string[] => [
  ...(ahead === null || ahead === 0 ? [] : [`${String(ahead)} to push`]),
  ...(behind === null || behind === 0 ? [] : [`${String(behind)} to pull`]),
];

/**
 * What a checkout holds that its remote does not, and the reverse, as short
 * phrases; empty when it is clean and in sync. Push and pull are as of the
 * last fetch.
 */
export const checkoutSummaryParts = (status: CheckoutStatus): string[] => {
  const uncommitted = status.modified + status.untracked;
  const upstreamParts = ((): string[] => {
    if (status.branch === null) return [];
    if (status.upstream === null) return ["not published"];
    if (status.ahead === null) return ["upstream gone"];
    return trackParts(status.ahead, status.behind);
  })();
  return [
    ...(uncommitted === 0 ? [] : [`${String(uncommitted)} uncommitted`]),
    ...upstreamParts,
  ];
};

/** Where a branch stands against the remote branch it tracks; gone is a badge of its own. */
export const branchTrackParts = (branch: CheckoutBranch): string[] => {
  if (branch.upstreamGone) return [];
  if (branch.upstream === null) return ["not published"];
  return trackParts(branch.ahead, branch.behind);
};
