import type {
  DiffImpactsResponse,
  DiffReadingOrderResponse,
  PullRequestCandidatesResponse,
  PullRequestChecksResponse,
  PullRequestCommitsResponse,
  PullRequestDetailResponse,
  PullRequestDiffResponse,
  PullRequestFilesResponse,
  PullRequestPerson,
  PullRequestReactable,
  PullRequestSummary,
  PullRequestTimelineResponse,
  ReviewflowPrDetail,
} from "@reviewflow/sdk";

export const ownerRepo = "acme/storefront";
export const number = 482;
export const ref = { ownerRepo, number };

const fetchedAt = "2026-11-06T09:30:00.000Z";
const read = {
  fetchedAt,
  checkedAt: fetchedAt,
  source: "github" as const,
  errors: [],
};

export const ada: PullRequestPerson = { login: "ada", avatarUrl: null };
export const grace: PullRequestPerson = { login: "grace", avatarUrl: null };
export const linus: PullRequestPerson = { login: "linus", avatarUrl: null };

const noReactions = (id: string): PullRequestReactable => ({
  id,
  reactions: [],
  viewerCanReact: true,
});

export const headSha = "9f2c1d7a4b3e8f60a1b2c3d4e5f60718293a4b5c";
export const baseSha = "1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d";

export const detail: PullRequestDetailResponse = {
  ...read,
  viewer: "grace",
  pullRequest: {
    ownerRepo,
    number,
    url: `https://github.com/${ownerRepo}/pull/${String(number)}`,
    title: "Cache the cart totals per session :rocket:",
    body: [
      "Recomputing the totals on every request was the slowest part of checkout.",
      "",
      "- [x] Cache keyed by session and cart version",
      "- [ ] Drop the cache on logout",
      "",
      "```ts",
      "const totals = cache.get(key) ?? computeTotals(cart);",
      "```",
    ].join("\n"),
    state: "open",
    author: ada,
    headRef: "ada/cart-totals-cache",
    baseRef: "main",
    headSha,
    baseSha,
    createdAt: "2026-11-04T10:00:00.000Z",
    updatedAt: "2026-11-06T09:00:00.000Z",
    lastEditedAt: null,
    additions: 42,
    deletions: 7,
    changedFiles: 2,
    mergeable: "mergeable",
    mergeState: "clean",
    mergeMethods: ["squash", "merge", "rebase"],
    mergeCommitMessages: {
      squash: { title: "Cache the cart totals per session (#482)", body: "" },
      merge: {
        title: "Merge pull request #482",
        body: "ada/cart-totals-cache",
      },
    },
    viewerCanUpdate: true,
    viewerCanUpdateBranch: false,
    viewerCanApplySuggestion: true,
    reviewDecision: "reviewRequired",
    labels: [
      { name: "performance", color: "0e8a16", description: null },
      { name: "needs review", color: "fbca04", description: null },
    ],
    assignees: [ada],
    requestedReviewers: [{ kind: "user", ...linus }],
    reviews: [{ author: "grace", state: "commented", submittedAt: fetchedAt }],
    commitsTotal: 2,
    ...noReactions("PR_kwDOAAA"),
    reactions: [{ content: "rocket", count: 2, viewerHasReacted: false }],
  },
};

export const checks: PullRequestChecksResponse = {
  ...read,
  checksTotal: 4,
  checks: [
    {
      name: "e2e / checkout",
      outcome: "failed",
      running: false,
      description: "2 tests failed",
      url: "https://github.com/acme/storefront/actions/runs/1",
    },
    {
      name: "build",
      outcome: "pending",
      running: true,
      description: "In progress",
      url: null,
    },
    {
      name: "lint",
      outcome: "passed",
      running: false,
      description: null,
      url: null,
    },
    {
      name: "unit",
      outcome: "passed",
      running: false,
      description: null,
      url: null,
    },
  ],
};

/** reviewflow's copy: the hold job and reviewflow's own check count nowhere */
export const reviewflowPr: ReviewflowPrDetail = {
  id: "pr-482",
  ownerRepo,
  number,
  title: "Round cart totals per line, not on the sum",
  url: `https://github.com/${ownerRepo}/pull/${String(number)}`,
  headRef: "fix/cart-rounding",
  baseRef: "main",
  headSha,
  baseSha,
  state: "open",
  reviewState: "requested",
  author: "ada",
  checks: {
    conclusion: "failed",
    passed: 2,
    failed: 1,
    pending: 1,
    running: 1,
    failedNames: ["e2e / checkout"],
    checkRuns: [
      {
        name: "e2e / checkout",
        status: "completed",
        conclusion: "failure",
        title: "2 tests failed",
        detailsUrl: "https://github.com/acme/storefront/actions/runs/1",
      },
      {
        name: "build",
        status: "in_progress",
        conclusion: null,
        title: "In progress",
        detailsUrl: null,
      },
    ],
    statuses: [
      {
        context: "hold",
        state: "pending",
        description: "Your job is on hold",
        targetUrl: null,
      },
    ],
  },
  lintFailed: false,
  approvedBy: [],
  changesRequestedBy: [],
  requestedReviewers: ["grace"],
  reRequestedReviewers: [],
  requestedTeams: [],
  assignees: [],
  labels: [],
  statusLinks: [],
  openedAt: fetchedAt,
  approvedAt: null,
  changes: null,
  unresolvedThreads: 1,
  mergeable: "mergeable",
  closedAt: null,
  lastActivityAt: null,
  commentActivityAt: null,
  reviewActivityAt: null,
  reviewCommentActivityAt: null,
  bodyEditedAt: null,
  updatedAt: fetchedAt,
};

export const timeline: PullRequestTimelineResponse = {
  ...read,
  timelineTruncated: false,
  timeline: [
    {
      kind: "event",
      action: "labeled",
      actor: ada,
      subject: null,
      label: { name: "performance", color: "0e8a16", description: null },
      detail: null,
      createdAt: "2026-11-04T10:01:00.000Z",
    },
    {
      kind: "event",
      action: "reviewRequested",
      actor: ada,
      subject: "linus",
      label: null,
      detail: null,
      createdAt: "2026-11-04T10:02:00.000Z",
    },
    {
      kind: "comment",
      ...noReactions("IC_1"),
      databaseId: 1,
      author: linus,
      body: "Nice. Does the cache survive a deploy? **Please** check `cartVersion`.",
      createdAt: "2026-11-05T08:00:00.000Z",
      lastEditedAt: null,
      url: "https://github.com/acme/storefront/pull/482#issuecomment-1",
      viewerCanUpdate: false,
      reactions: [{ content: "thumbsUp", count: 1, viewerHasReacted: true }],
    },
    {
      kind: "thread",
      id: "PRT_1",
      path: "src/cart/totals.ts",
      line: 4,
      startLine: null,
      side: "RIGHT",
      startSide: null,
      originalLine: 4,
      originalStartLine: null,
      resolved: false,
      outdated: false,
      viewerCanResolve: true,
      viewerCanUnresolve: true,
      viewerCanReply: true,
      diffHunk: "@@ -1,5 +1,9 @@",
      commentsTotal: 2,
      createdAt: "2026-11-05T09:00:00.000Z",
      comments: [
        {
          ...noReactions("PRRC_1"),
          databaseId: 11,
          author: grace,
          // the suggestion block is markdown, `${}` is literal text
          // oxlint-disable-next-line no-template-curly-in-string
          body: "Should the key include the currency?\n\n```suggestion\nconst key = `${sessionId}:${cartVersion}:${currency}`;\n```",
          createdAt: "2026-11-05T09:00:00.000Z",
          lastEditedAt: null,
          url: "https://github.com/acme/storefront/pull/482#discussion_r11",
          viewerCanUpdate: true,
        },
        {
          ...noReactions("PRRC_2"),
          databaseId: 12,
          author: ada,
          body: "Good catch, adding it.",
          createdAt: "2026-11-05T09:30:00.000Z",
          lastEditedAt: null,
          url: "https://github.com/acme/storefront/pull/482#discussion_r12",
          viewerCanUpdate: false,
        },
      ],
    },
    {
      kind: "review",
      ...noReactions("PRR_1"),
      databaseId: 21,
      author: grace,
      state: "commented",
      body: "Left a few notes on the key.",
      createdAt: "2026-11-05T09:05:00.000Z",
      lastEditedAt: null,
      url: "https://github.com/acme/storefront/pull/482#pullrequestreview-21",
      viewerCanUpdate: true,
      commitOid: headSha,
    },
  ],
};

export const commits: PullRequestCommitsResponse = {
  ...read,
  commits: [
    {
      oid: "a1b2c3d4e5f6071829304a5b6c7d8e9f00112233",
      parentOid: baseSha,
      merge: false,
      headline: "feat(cart): add a totals cache",
      body: "",
      author: ada,
      committedAt: "2026-11-04T09:50:00.000Z",
    },
    {
      oid: headSha,
      parentOid: "a1b2c3d4e5f6071829304a5b6c7d8e9f00112233",
      merge: false,
      headline: "fix(cart): key the cache by cart version",
      body: "A stale entry survived a cart edit.",
      author: ada,
      committedAt: "2026-11-05T11:20:00.000Z",
    },
  ],
};

export const files: PullRequestFilesResponse = {
  ...read,
  viewerLastReview: null,
  files: [
    {
      path: "src/cart/totals.ts",
      additions: 8,
      deletions: 2,
      change: "modified",
      viewed: "unviewed",
    },
    {
      path: "src/cart/cache.ts",
      additions: 34,
      deletions: 0,
      change: "added",
      viewed: "viewed",
    },
  ],
};

export const candidates: PullRequestCandidatesResponse = {
  errors: [],
  repoLabels: [
    { name: "performance", color: "0e8a16", description: null },
    { name: "needs review", color: "fbca04", description: null },
    { name: "bug", color: "d73a4a", description: null },
  ],
  suggestedReviewers: [linus],
  reviewerCandidates: [grace],
  teamCandidates: [{ slug: "checkout", name: "Checkout" }],
  assigneeCandidates: [ada, grace, linus],
};

export const patch = `diff --git a/src/cart/totals.ts b/src/cart/totals.ts
index 1111111..2222222 100644
--- a/src/cart/totals.ts
+++ b/src/cart/totals.ts
@@ -1,6 +1,12 @@
 import { computeTotals } from "./compute.ts";
+import { cache } from "./cache.ts";
 
-export const totalsOf = (cart: Cart) => {
-  return computeTotals(cart);
+export const totalsOf = (sessionId: string, cart: Cart) => {
+  const key = \`\${sessionId}:\${cart.version}\`;
+  const cached = cache.get(key);
+  if (cached !== undefined) return cached;
+  const totals = computeTotals(cart);
+  cache.set(key, totals);
+  return totals;
 };
 
 export const itemCount = (cart: Cart) => cart.items.length;
diff --git a/src/cart/cache.ts b/src/cart/cache.ts
new file mode 100644
index 0000000..3333333
--- /dev/null
+++ b/src/cart/cache.ts
@@ -0,0 +1,6 @@
+const entries = new Map<string, unknown>();
+
+export const cache = {
+  get: (key: string) => entries.get(key),
+  set: (key: string, value: unknown) => entries.set(key, value),
+};
`;

export const diff: PullRequestDiffResponse = {
  source: "git",
  fallbackReason: null,
  whitespace: "show",
  patch,
  sides: null,
  omitted: [{ path: "assets/hero.png", reason: "binary" }],
  groups: [{ name: "", paths: ["src/cart/totals.ts", "src/cart/cache.ts"] }],
};

const cachePatchStart = patch.indexOf("diff --git a/src/cart/cache.ts");

/** The two commits' own diffs: each changes a file the other does not. */
export const commitDiffs: Record<string, PullRequestDiffResponse> = {
  a1b2c3d4e5f6071829304a5b6c7d8e9f00112233: {
    ...diff,
    patch: patch.slice(cachePatchStart),
    omitted: [],
    groups: [{ name: "", paths: ["src/cart/cache.ts"] }],
  },
  [headSha]: {
    ...diff,
    patch: patch.slice(0, cachePatchStart),
    omitted: [],
    groups: [{ name: "", paths: ["src/cart/totals.ts"] }],
  },
};

const readingOrderPatch = `diff --git a/packages/app/src/cart-screen.tsx b/packages/app/src/cart-screen.tsx
index 4444444..5555555 100644
--- a/packages/app/src/cart-screen.tsx
+++ b/packages/app/src/cart-screen.tsx
@@ -1,3 +1,3 @@
 import { totalsOf } from "@acme/sdk";
 
-export const CartScreen = ({ cart }) => totalsOf(cart);
+export const CartScreen = ({ sessionId, cart }) => totalsOf(sessionId, cart);
${patch.replaceAll("src/cart/", "packages/sdk/src/cart/")}diff --git a/packages/sdk/src/cart/totals.test.ts b/packages/sdk/src/cart/totals.test.ts
new file mode 100644
index 0000000..6666666
--- /dev/null
+++ b/packages/sdk/src/cart/totals.test.ts
@@ -0,0 +1,5 @@
+import { totalsOf } from "./totals.ts";
+
+test("caches the totals of a session", () => {
+  expect(totalsOf("s", cart)).toBe(totalsOf("s", cart));
+});
`;

/** A change across two packages, with a test: what the reading order reorders. */
export const readingOrderDiff: PullRequestDiffResponse = {
  ...diff,
  patch: readingOrderPatch,
  omitted: [],
  groups: [
    { name: "packages/app", paths: ["packages/app/src/cart-screen.tsx"] },
    {
      name: "packages/sdk",
      paths: [
        "packages/sdk/src/cart/totals.ts",
        "packages/sdk/src/cart/cache.ts",
        "packages/sdk/src/cart/totals.test.ts",
      ],
    },
  ],
};

export const readingOrder: DiffReadingOrderResponse = {
  groups: [
    {
      name: "packages/app",
      files: [
        {
          path: "packages/app/src/cart-screen.tsx",
          entry: false,
          root: true,
          attached: [],
        },
      ],
    },
    {
      name: "packages/sdk",
      files: [
        {
          path: "packages/sdk/src/cart/totals.ts",
          entry: true,
          root: true,
          attached: ["packages/sdk/src/cart/totals.test.ts"],
        },
        {
          path: "packages/sdk/src/cart/cache.ts",
          entry: false,
          root: false,
          attached: [],
        },
      ],
    },
  ],
};

/** What `readingOrderDiff` touches that files outside it use. */
export const impacts: DiffImpactsResponse = {
  tooLarge: false,
  files: [
    {
      path: "packages/sdk/src/cart/totals.ts",
      exports: [
        {
          name: "totalsOf",
          removed: false,
          importers: [
            { path: "packages/ui/src/cart-summary.tsx", test: false },
            { path: "packages/app/src/checkout.ts", test: false },
            { path: "packages/ui/src/cart-summary.test.tsx", test: true },
          ],
        },
      ],
    },
    {
      path: "packages/sdk/src/cart/cache.ts",
      exports: [
        {
          name: "clearCache",
          removed: true,
          importers: [{ path: "packages/app/src/logout.ts", test: false }],
        },
        {
          name: "cacheKeyOf",
          removed: false,
          importers: [
            { path: "packages/ui/src/cart-summary.test.tsx", test: true },
          ],
        },
      ],
    },
  ],
  notAnalyzed: ["packages/app/package.json"],
  unresolvedIn: ["packages/legacy"],
};

/** What an app holds of the pull request before GitHub answers. */
export const summary: PullRequestSummary = {
  ownerRepo,
  number,
  title: detail.pullRequest.title,
  url: detail.pullRequest.url,
  state: "open",
  reviewState: "requested",
  author: "ada",
  headRef: detail.pullRequest.headRef,
  baseRef: detail.pullRequest.baseRef,
  headSha,
  baseSha,
};
