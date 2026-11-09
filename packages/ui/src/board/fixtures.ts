import type {
  ReviewflowBoardGroup,
  ReviewflowBoardPr,
  ReviewflowBoardResponse,
  ReviewflowClosedPullRequestsResponse,
  ReviewflowConnectionStatus,
} from "@reviewflow/sdk";
import type { PullRequestBoardExtraSection } from "./pull-request-board.tsx";

export const fetchedAt = "2026-11-06T09:30:00.000Z";

const pr = (
  number: number,
  title: string,
  overrides: Partial<ReviewflowBoardPr> = {},
): ReviewflowBoardPr => ({
  id: `pr-${String(number)}`,
  ownerRepo: "acme/storefront",
  number,
  title,
  url: `https://github.com/acme/storefront/pull/${String(number)}`,
  headRef: `feat/${String(number)}`,
  state: "open",
  reviewState: "requested",
  author: "ada",
  checksFailed: 0,
  checksConclusion: "passed",
  checksRunning: 0,
  failedChecks: [],
  lintFailed: false,
  approvedBy: [],
  changesRequestedBy: [],
  requestedReviewers: ["grace"],
  reRequestedReviewers: [],
  requestedTeams: [],
  assignees: [],
  statusLinks: [],
  changes: { changedFiles: 4, additions: 120, deletions: 18 },
  openedAt: "2026-11-04T10:00:00.000Z",
  approvedAt: null,
  closedAt: null,
  labels: [],
  unresolvedThreads: null,
  mergeable: "mergeable",
  updatedAt: fetchedAt,
  ...overrides,
});

/** keys, order and titles as reviewflow sends them, see `prBucketDisplay` in @reviewflow/modules */
const groups: ReviewflowBoardGroup[] = [
  {
    key: "requesting-attention",
    title: "PRs requesting your attention",
    buckets: [
      {
        key: "requested-reviews",
        title: "Requested reviews",
        total: 2,
        prs: [
          pr(482, "Cache the cart totals per session"),
          pr(490, "Drop the legacy checkout route", {
            author: "linus",
            labels: [":broom: cleanup"],
            statusLinks: [
              {
                name: "ticket",
                label: "SHOP-212",
                url: "https://tracker.example.com/SHOP-212",
              },
            ],
          }),
        ],
      },
      {
        key: "ready-to-merge",
        title: "Ready to merge",
        total: 4,
        prs: [
          pr(455, "Fix the rounding of discounts", {
            author: "grace",
            reviewState: "approved",
            approvedBy: ["ada"],
            approvedAt: "2026-11-05T15:00:00.000Z",
            requestedReviewers: [],
          }),
        ],
      },
      {
        key: "changes-requested",
        title: "Changes requested",
        total: 1,
        prs: [
          pr(471, "Paginate the order history", {
            author: "grace",
            reviewState: "changesRequested",
            changesRequestedBy: ["ada"],
            unresolvedThreads: 3,
            checksConclusion: "failed",
            failedChecks: ["unit tests"],
          }),
        ],
      },
    ],
  },
  {
    key: "in-progress",
    title: "Your PRs in progress",
    buckets: [
      {
        key: "drafts",
        title: "Drafts",
        total: 1,
        prs: [
          pr(500, "Experiment: edge-cached product pages", {
            author: "grace",
            state: "draft",
            checksConclusion: "unknown",
            requestedReviewers: [],
            changes: null,
          }),
        ],
      },
      {
        key: "waiting-for-review",
        title: "Waiting for review",
        total: 1,
        prs: [
          pr(503, "Move the price formatting to the server", {
            author: "grace",
            requestedReviewers: ["ada"],
            requestedTeams: ["frontend"],
            checksRunning: 2,
            checksConclusion: "unknown",
          }),
        ],
      },
    ],
  },
];

export const boardResponse: ReviewflowBoardResponse = {
  board: { fetchedAt, groups },
  viewer: "grace",
};

export const emptyBoardResponse: ReviewflowBoardResponse = {
  board: { fetchedAt, groups: [] },
  viewer: "grace",
};

export const connectedStatus: ReviewflowConnectionStatus = {
  configured: true,
  url: "https://reviewflow.example.com",
  login: "grace",
  accounts: ["grace", "acme"],
  stream: "live",
  error: null,
};

export const notConfiguredStatus: ReviewflowConnectionStatus = {
  configured: false,
  url: null,
  login: null,
  accounts: [],
  stream: "off",
  error: null,
};

/** Rows an app lists under the buckets: pull requests no bucket carries. */
export const extraSections: PullRequestBoardExtraSection[] = [
  {
    key: "task-pull-requests",
    title: "Task pull requests",
    rows: [
      pr(512, "Wire the invoice export to the new queue", {
        author: "grace",
        requestedReviewers: [],
        reviewState: null,
      }),
      pr(515, "Backfill the legacy order currencies", {
        author: "grace",
        state: "draft",
        requestedReviewers: [],
        checksConclusion: "unknown",
        changes: null,
      }),
    ],
  },
];

export const closedResponse: ReviewflowClosedPullRequestsResponse = {
  total: 245,
  viewer: "grace",
  prs: [
    pr(440, "Stop retrying declined payments", {
      state: "merged",
      closedAt: "2026-11-05T17:20:00.000Z",
    }),
    pr(437, "Try a second payment provider", {
      state: "closed",
      author: "linus",
      checksConclusion: "failed",
      failedChecks: ["e2e"],
      closedAt: "2026-11-03T11:05:00.000Z",
    }),
  ],
};
