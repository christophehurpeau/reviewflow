import type { PrBucket } from "./Pr.ts";
import type { PrRowDisplayOptions } from "./formatPrRow.ts";

/**
 * The two headers every client groups the buckets under: what the viewer is
 * expected to act on, and what they opened and are waiting on.
 */
export type PrBucketGroup = "in-progress" | "requesting-attention";

export interface PrBucketDisplay {
  group: PrBucketGroup;
  title: string;
  rowOptions: PrRowDisplayOptions;
}

/**
 * How each bucket is announced, shared so the slack home, the webapp and the
 * editor extension cannot drift apart. Only the wording and the row options
 * live here: the icon is whatever the client can render — a slack emoji, a
 * phosphor element, a vscode codicon — and stays at the call site.
 */
export const prBucketDisplay: Record<PrBucket, PrBucketDisplay> = {
  "re-requested-reviews": {
    group: "requesting-attention",
    title: "Re-Requested reviews",
    // the review is under way there, so there is nothing left to start
    rowOptions: { showReRequests: false, reviewRequestVerb: "requested" },
  },
  "requested-reviews": {
    group: "requesting-attention",
    title: "Requested reviews",
    rowOptions: { reviewRequestVerb: "requested" },
  },
  "ready-to-merge": {
    group: "requesting-attention",
    title: "Ready to merge",
    rowOptions: { reviewRequestVerb: "requested" },
  },
  "changes-requested": {
    group: "requesting-attention",
    title: "Changes requested",
    rowOptions: { showPassedChecks: false, reviewRequestVerb: "requested" },
  },
  "opened-missing-review-request": {
    group: "in-progress",
    title: "Missing request for review",
    rowOptions: {},
  },
  drafts: {
    group: "in-progress",
    title: "Drafts",
    rowOptions: { showDraft: false, showPassedChecks: false },
  },
  "waiting-for-review": {
    group: "in-progress",
    title: "Waiting for review",
    rowOptions: {},
  },
};

/**
 * A review asked again is one the viewer has already been through, so it comes
 * before the ones they have not seen.
 */
export const prBucketsInOrder: PrBucket[] = [
  "re-requested-reviews",
  "requested-reviews",
  "ready-to-merge",
  "changes-requested",
  "opened-missing-review-request",
  "drafts",
  "waiting-for-review",
];

export const prBucketsInGroup = (group: PrBucketGroup): PrBucket[] =>
  prBucketsInOrder.filter((bucket) => prBucketDisplay[bucket].group === group);
