import { describe, expect, it } from "vitest";
import type { ReviewflowBoardPr } from "@reviewflow/sdk";
import type { ReviewflowRowContext } from "./facts.ts";
import {
  formatPrChanges,
  reviewflowPrChangesRequested,
  reviewflowPrFailure,
  reviewflowPrFlowDate,
  reviewflowPrOwners,
  reviewflowPrProgress,
} from "./facts.ts";

const facts = (
  overrides: Partial<ReviewflowBoardPr> = {},
): Pick<
  ReviewflowBoardPr,
  | "approvedBy"
  | "changesRequestedBy"
  | "checksConclusion"
  | "checksRunning"
  | "failedChecks"
  | "lintFailed"
  | "mergeable"
  | "requestedReviewers"
  | "requestedTeams"
  | "reRequestedReviewers"
  | "unresolvedThreads"
> => ({
  approvedBy: [],
  changesRequestedBy: [],
  checksConclusion: "unknown",
  checksRunning: 0,
  failedChecks: [],
  lintFailed: false,
  mergeable: "mergeable",
  reRequestedReviewers: [],
  requestedReviewers: [],
  requestedTeams: [],
  unresolvedThreads: null,
  ...overrides,
});

const waiting: ReviewflowRowContext = {
  bucketKey: "waiting-for-review",
  groupKey: "in-progress",
  viewer: "me",
};

describe("reviewflowPrFailure", () => {
  it("is null when nothing blocks the merge", () => {
    expect(reviewflowPrFailure(facts({ checksConclusion: "passed" }))).toBe(
      null,
    );
  });

  it("names the failing checks, then the lint and the conflict", () => {
    expect(
      reviewflowPrFailure(
        facts({
          checksConclusion: "failed",
          failedChecks: ["build"],
          lintFailed: true,
          mergeable: "conflicting",
        }),
      ),
    ).toBe("check failed: build · pr lint failed · conflicts");
  });

  it("lists nine names at most", () => {
    const names = Array.from({ length: 11 }, (_, index) => `c${String(index)}`);
    expect(reviewflowPrFailure(facts({ failedChecks: names }))).toBe(
      "checks failed: c0, c1, c2, c3, c4, c5, c6, c7, c8 +2",
    );
  });

  it("says the checks failed when reviewflow names none", () => {
    expect(reviewflowPrFailure(facts({ checksConclusion: "failed" }))).toBe(
      "checks failed",
    );
  });
});

describe("reviewflowPrChangesRequested", () => {
  it("names who asked, the viewer as you", () => {
    expect(reviewflowPrChangesRequested(facts(), "me")).toBeNull();
    expect(
      reviewflowPrChangesRequested(
        facts({ changesRequestedBy: ["a", "me"] }),
        "me",
      ),
    ).toBe("changes requested by @a, you");
  });
});

describe("reviewflowPrProgress", () => {
  it("is null for a pull request with nothing to say", () => {
    expect(
      reviewflowPrProgress(facts({ unresolvedThreads: 0 }), waiting),
    ).toBeNull();
  });

  it("joins checks, approvals, threads and awaited reviewers", () => {
    expect(
      reviewflowPrProgress(
        facts({
          checksConclusion: "passed",
          approvedBy: ["a"],
          unresolvedThreads: 1,
          requestedReviewers: ["b"],
          reRequestedReviewers: ["c"],
          requestedTeams: ["front"],
        }),
        waiting,
      ),
    ).toBe(
      "checks passed · approved by @a · 1 unresolved thread · awaiting @b, @c, #front",
    );
  });

  it("counts the running checks, even beside a failure", () => {
    expect(
      reviewflowPrProgress(
        facts({ checksConclusion: "failed", checksRunning: 2 }),
        waiting,
      ),
    ).toBe("2 checks running");
  });

  it("leaves to the bucket title what it already says", () => {
    const pr = facts({
      checksConclusion: "passed",
      requestedReviewers: ["b"],
      reRequestedReviewers: ["me"],
    });
    expect(
      reviewflowPrProgress(pr, {
        bucketKey: "drafts",
        groupKey: "in-progress",
        viewer: "me",
      }),
    ).toBe("awaiting @b, you");
    expect(
      reviewflowPrProgress(pr, {
        bucketKey: "re-requested-reviews",
        groupKey: "requesting-attention",
        viewer: "me",
      }),
    ).toBe("checks passed · requested @b");
  });
});

describe("reviewflowPrOwners", () => {
  it("names the author, and the assignees when they are someone else", () => {
    expect(reviewflowPrOwners({ author: "a", assignees: [] }, "me")).toBe(
      "by @a",
    );
    expect(reviewflowPrOwners({ author: "a", assignees: ["a"] }, "me")).toBe(
      "by @a",
    );
    expect(reviewflowPrOwners({ author: "a", assignees: ["me"] }, "me")).toBe(
      "by @a · assigned to you",
    );
    expect(
      reviewflowPrOwners({ author: "a", assignees: ["a", "b"] }, "me"),
    ).toBe("assigned to @a, @b");
  });

  it("names nobody when the viewer is the only person", () => {
    expect(
      reviewflowPrOwners({ author: "me", assignees: ["me"] }, "me"),
    ).toBeNull();
    expect(reviewflowPrOwners({ author: null, assignees: [] }, null)).toBe(
      null,
    );
  });
});

describe("reviewflowPrFlowDate", () => {
  const now = new Date("2026-10-18T12:00:00");

  it("prefers the approval to the opening", () => {
    expect(
      reviewflowPrFlowDate(
        { openedAt: "2026-10-01T09:00:00", approvedAt: "2026-10-18T09:00:00" },
        { now, locale: "en-GB" },
      ),
    ).toBe("approved today 09:00");
    expect(
      reviewflowPrFlowDate(
        { openedAt: "2026-10-18T09:00:00", approvedAt: null },
        { now, locale: "en-GB" },
      ),
    ).toBe("opened today 09:00");
    expect(reviewflowPrFlowDate({ openedAt: null, approvedAt: null })).toBe(
      null,
    );
  });
});

describe("formatPrChanges", () => {
  it("counts files and lines", () => {
    expect(
      formatPrChanges({ changedFiles: 1, additions: 12, deletions: 3 }),
    ).toBe("1 file +12 −3");
  });
});
