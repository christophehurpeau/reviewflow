import { describe, expect, it } from "vitest";
import { changedPullRequestParts } from "./changedParts.ts";
import type { ReviewflowPrDetail } from "./client.ts";

const detail = (
  overrides: Partial<ReviewflowPrDetail> = {},
): ReviewflowPrDetail => ({
  id: "rf-12",
  ownerRepo: "owner/repo",
  number: 12,
  title: "a pull request",
  url: "https://github.com/owner/repo/pull/12",
  headRef: "feat/one",
  baseRef: "main",
  headSha: "abc",
  baseSha: "def",
  state: "open",
  reviewState: "requested",
  author: "me",
  checks: {
    conclusion: "inProgress",
    passed: 1,
    failed: 0,
    pending: 2,
    running: 1,
    failedNames: [],
    checkRuns: null,
    statuses: null,
  },
  lintFailed: false,
  approvedBy: [],
  changesRequestedBy: [],
  requestedReviewers: [],
  reRequestedReviewers: [],
  requestedTeams: [],
  assignees: [],
  labels: [],
  statusLinks: [],
  changes: null,
  openedAt: null,
  approvedAt: null,
  unresolvedThreads: 0,
  mergeable: "mergeable",
  closedAt: null,
  commentActivityAt: null,
  reviewActivityAt: null,
  reviewCommentActivityAt: null,
  bodyEditedAt: null,
  updatedAt: "2026-10-18T09:00:00.000Z",
  ...overrides,
});

describe("changedPullRequestParts", () => {
  it("makes every part stale on a push, all but the head's checks when the base moved", () => {
    expect(
      changedPullRequestParts(detail(), detail({ headSha: "abd" })),
    ).toEqual(["detail", "checks", "timeline", "commits", "files"]);
    expect(
      changedPullRequestParts(detail(), detail({ baseSha: "deg" })),
    ).toEqual(["detail", "timeline", "commits", "files"]);
  });

  it("reads the checks alone while they run, the merge state too once they conclude", () => {
    expect(
      changedPullRequestParts(
        detail(),
        detail({
          checks: { ...detail().checks, passed: 2, pending: 1 },
          updatedAt: "2026-10-18T09:01:00.000Z",
        }),
      ),
    ).toEqual(["checks"]);
    expect(
      changedPullRequestParts(
        detail(),
        detail({
          checks: { ...detail().checks, conclusion: "passed", pending: 0 },
        }),
      ),
    ).toEqual(["detail", "checks"]);
  });

  it("reads the timeline alone on a comment, the header too on a review", () => {
    expect(
      changedPullRequestParts(
        detail(),
        detail({ commentActivityAt: "2026-10-18T09:01:00.000Z" }),
      ),
    ).toEqual(["timeline"]);
    expect(
      changedPullRequestParts(detail(), detail({ approvedBy: ["carol"] })),
    ).toEqual(["detail", "timeline"]);
  });

  it("reads the header alone on an edited description, the timeline alone on a review comment", () => {
    expect(
      changedPullRequestParts(
        detail(),
        detail({ bodyEditedAt: "2026-10-18T09:01:00.000Z" }),
      ),
    ).toEqual(["detail"]);
    expect(
      changedPullRequestParts(
        detail(),
        detail({ reviewCommentActivityAt: "2026-10-18T09:01:00.000Z" }),
      ),
    ).toEqual(["timeline"]);
  });

  it("reads the merge state again once the last conversation is resolved, the timeline alone before", () => {
    expect(
      changedPullRequestParts(
        detail({ unresolvedThreads: 2 }),
        detail({ unresolvedThreads: 1 }),
      ),
    ).toEqual(["timeline"]);
    expect(
      changedPullRequestParts(
        detail({ unresolvedThreads: 1 }),
        detail({ unresolvedThreads: 0 }),
      ),
    ).toEqual(["detail", "timeline"]);
    expect(
      changedPullRequestParts(
        detail({ unresolvedThreads: 0 }),
        detail({ unresolvedThreads: 1 }),
      ),
    ).toEqual(["detail", "timeline"]);
  });

  it("reads the header and the timeline again on a label change", () => {
    expect(
      changedPullRequestParts(detail(), detail({ labels: ["bug"] })),
    ).toEqual(["detail", "timeline"]);
  });

  it("finds nothing when only reviewflow's write date moved", () => {
    expect(
      changedPullRequestParts(
        detail(),
        detail({ updatedAt: "2026-10-18T09:05:00.000Z" }),
      ),
    ).toEqual([]);
  });
});
