import { describe, expect, it } from "vitest";
import type { ReviewflowPr } from "reviewflow-core";
import { toPrSummary } from "./toPrSummary.ts";

const buildPr = (overrides: Partial<ReviewflowPr> = {}): ReviewflowPr =>
  ({
    _id: "pr-id",
    account: { id: 1, login: "org", type: "Organization" },
    repo: { id: 2, name: "repo" },
    pr: { number: 42 },
    title: "feat: something",
    isDraft: false,
    isClosed: false,
    reviews: {
      approved: [],
      changesRequested: [],
      commented: [],
      dismissed: [],
      reviewRequested: [],
      teamReviewRequested: [],
    },
    assignees: [],
    ...overrides,
  }) as unknown as ReviewflowPr;

describe("toPrSummary checks", () => {
  it("reports unknown when the pull request has no check nor status", () => {
    expect(toPrSummary(buildPr()).checks).toEqual({
      conclusion: "unknown",
      failedCount: 0,
      runningCount: 0,
      failedNames: [],
    });
  });

  it("names the failed checks and statuses", () => {
    const summary = toPrSummary(
      buildPr({
        checksConclusion: {
          a: { name: "build", conclusion: "failure" },
          b: { name: "test", conclusion: "success" },
          c: { name: "e2e", conclusion: "timed_out" },
        },
        statusesConclusion: {
          d: { context: "netlify", state: "error" },
        },
      }),
    );

    expect(summary.checks).toEqual({
      conclusion: "failed",
      failedCount: 3,
      runningCount: 0,
      failedNames: ["build", "e2e", "netlify"],
    });
  });

  it("counts the running checks and statuses when nothing failed", () => {
    const summary = toPrSummary(
      buildPr({
        checksConclusion: {
          a: { name: "build", conclusion: null },
          b: { name: "test", conclusion: "success" },
        },
        statusesConclusion: {
          c: { context: "netlify", state: "pending" },
        },
      }),
    );

    expect(summary.checks).toEqual({
      conclusion: "in-progress",
      failedCount: 0,
      runningCount: 2,
      failedNames: [],
    });
  });

  it("passes once every check and status settled without failure", () => {
    const summary = toPrSummary(
      buildPr({
        checksConclusion: {
          a: { name: "build", conclusion: "success" },
          b: { name: "flaky", conclusion: "skipped" },
        },
        statusesConclusion: {
          c: { context: "netlify", state: "success" },
        },
      }),
    );

    expect(summary.checks.conclusion).toBe("passed");
  });
});

describe("toPrSummary lint", () => {
  it("flags a failing reviewflow lint status", () => {
    const pr = buildPr({
      lintStatuses: [
        {
          name: "lint-pr",
          status: { type: "failure", title: "invalid title", summary: "" },
        },
      ],
    });

    expect(toPrSummary(pr).lintFailed).toBe(true);
  });

  it("does not flag a successful lint status", () => {
    const pr = buildPr({
      lintStatuses: [
        {
          name: "lint-pr",
          status: { type: "success", title: "PR is valid", summary: "" },
        },
      ],
    });

    expect(toPrSummary(pr).lintFailed).toBe(false);
  });
});

describe("toPrSummary changes", () => {
  it("forwards the changes information when reviewflow computed it", () => {
    const pr = buildPr({
      changesInformation: { changedFiles: 4, additions: 120, deletions: 30 },
    });

    expect(toPrSummary(pr).changes).toEqual({
      changedFiles: 4,
      additions: 120,
      deletions: 30,
    });
  });
});
