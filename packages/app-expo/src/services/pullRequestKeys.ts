import type { PullRequestRef } from "@reviewflow/sdk";

export const pullRequestKey = ({ ownerRepo, number }: PullRequestRef) =>
  ["pullRequest", ownerRepo, number] as const;

/** Every part read from GitHub: what `reload` reads again. */
export const partsKey = (ref: PullRequestRef) =>
  [...pullRequestKey(ref), "part"] as const;

/** reviewflow's copy, read again when the checks change */
export const reviewflowPrKey = (ref: PullRequestRef) =>
  [...pullRequestKey(ref), "reviewflow"] as const;
