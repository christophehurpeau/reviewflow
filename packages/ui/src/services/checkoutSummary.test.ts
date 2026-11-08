import { describe, expect, it } from "vitest";
import type { CheckoutBranch, CheckoutStatus } from "@reviewflow/sdk";
import { branchTrackParts, checkoutSummaryParts } from "./checkoutSummary.ts";

const status = (overrides: Partial<CheckoutStatus>): CheckoutStatus => ({
  path: "/repo",
  branch: "main",
  commit: null,
  upstream: "origin/main",
  ahead: 0,
  behind: 0,
  modified: 0,
  untracked: 0,
  ...overrides,
});

const branch = (overrides: Partial<CheckoutBranch>): CheckoutBranch => ({
  name: "feat",
  sha: "a".repeat(40),
  upstream: "origin/feat",
  ahead: 0,
  behind: 0,
  upstreamGone: false,
  merged: false,
  worktreePath: null,
  lastCommit: { subject: "x", committedAt: "2026-11-08T10:00:00.000Z" },
  ...overrides,
});

describe("checkoutSummaryParts", () => {
  it("is empty for a clean checkout in sync", () => {
    expect(checkoutSummaryParts(status({}))).toEqual([]);
  });

  it("counts the uncommitted files, then what to push and pull", () => {
    expect(
      checkoutSummaryParts(
        status({ modified: 2, untracked: 1, ahead: 3, behind: 1 }),
      ),
    ).toEqual(["3 uncommitted", "3 to push", "1 to pull"]);
  });

  it("says when the branch is not published or its upstream is gone", () => {
    expect(
      checkoutSummaryParts(
        status({ upstream: null, ahead: null, behind: null }),
      ),
    ).toEqual(["not published"]);
    expect(checkoutSummaryParts(status({ ahead: null, behind: null }))).toEqual(
      ["upstream gone"],
    );
  });

  it("says nothing about a remote on a detached HEAD", () => {
    expect(
      checkoutSummaryParts(
        status({ branch: null, upstream: null, ahead: null, behind: null }),
      ),
    ).toEqual([]);
  });
});

describe("branchTrackParts", () => {
  it("reads push, pull and not published, leaving gone to its badge", () => {
    expect(branchTrackParts(branch({ ahead: 1, behind: 2 }))).toEqual([
      "1 to push",
      "2 to pull",
    ]);
    expect(
      branchTrackParts(branch({ upstream: null, ahead: null, behind: null })),
    ).toEqual(["not published"]);
    expect(
      branchTrackParts(
        branch({ upstreamGone: true, ahead: null, behind: null }),
      ),
    ).toEqual([]);
  });
});
