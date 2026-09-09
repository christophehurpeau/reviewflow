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
      runningCount: 2,
      failedNames: [],
    });
  });

  it("ignores held checks and statuses, failed or pending", () => {
    const summary = toPrSummary(
      buildPr({
        checksConclusion: {
          a: { name: "ci/hold-deploy", conclusion: "failure" },
          b: { name: "ci/hold-e2e", conclusion: null },
        },
        statusesConclusion: {
          c: { context: "ci/hold-preview", state: "error" },
          d: { context: "codecov/patch", state: "pending" },
        },
      }),
    );

    expect(summary.checks).toEqual({
      conclusion: "passed",
      runningCount: 0,
      failedNames: [],
    });
  });

  it("ignores the checks the account config allows to fail", () => {
    const summary = toPrSummary(
      buildPr({
        account: { id: 1, login: "ornikar", type: "Organization" },
        checksConclusion: {
          a: { name: "build", conclusion: "failure" },
        },
        statusesConclusion: {
          b: { context: "SonarCloud Code Analysis", state: "failure" },
          c: { context: "codecov/project", state: "failure" },
        },
      }),
    );

    expect(summary.checks).toEqual({
      conclusion: "failed",
      runningCount: 0,
      failedNames: ["build"],
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

describe("toPrSummary reviews", () => {
  it("names the reviewers who requested changes", () => {
    const pr = buildPr({
      reviews: {
        approved: [{ id: 1, login: "dan" }],
        changesRequested: [
          { id: 2, login: "erin" },
          { id: 3, login: "frank" },
        ],
        commented: [],
        dismissed: [],
        reviewRequested: [],
        teamReviewRequested: [],
      },
    });

    const summary = toPrSummary(pr);
    expect(summary.approvedBy).toEqual([{ id: 1, login: "dan" }]);
    expect(summary.changesRequestedBy).toEqual([
      { id: 2, login: "erin" },
      { id: 3, login: "frank" },
    ]);
  });

  /** a review asked of someone who already reviewed is a different ask */
  it("tells a first review request apart from one asked again", () => {
    const summary = toPrSummary(
      buildPr({
        reviews: {
          approved: [],
          changesRequested: [],
          commented: [],
          dismissed: [],
          reviewRequested: [
            { id: 4, login: "grace" },
            { id: 5, login: "heidi" },
          ],
          teamReviewRequested: [],
          reviewed: [{ id: 5, login: "heidi" }],
        },
      }),
    );

    expect(summary.requestedReviewers).toEqual([{ id: 4, login: "grace" }]);
    expect(summary.reRequestedReviewers).toEqual([{ id: 5, login: "heidi" }]);
  });
});

describe("toPrSummary defaults", () => {
  /** older documents were stored before some of these fields existed */
  it("survives a pull request missing its reviews and assignees", () => {
    const summary = toPrSummary(
      buildPr({ reviews: undefined, assignees: undefined }),
    );

    expect(summary.approvedBy).toEqual([]);
    expect(summary.changesRequestedBy).toEqual([]);
    expect(summary.requestedReviewers).toEqual([]);
    expect(summary.requestedTeams).toEqual([]);
    expect(summary.reRequestedReviewers).toEqual([]);
    expect(summary.assignees).toEqual([]);
  });

  it("survives reviews holding only some of its groups", () => {
    const summary = toPrSummary(
      buildPr({
        reviews: { reviewRequested: [{ id: 1, login: "bob" }] } as any,
      }),
    );

    expect(summary.approvedBy).toEqual([]);
    expect(summary.requestedTeams).toEqual([]);
    expect(summary.requestedReviewers).toEqual([{ id: 1, login: "bob" }]);
  });
});

describe("toPrSummary status links", () => {
  it("labels a link from the markdown link its summary carries", () => {
    const pr = buildPr({
      lintStatuses: [
        {
          name: "notion-ticket",
          status: {
            type: "success",
            inBody: true,
            title: "✓ Notion ticket: GEN-1234",
            summary: "[GEN-1234](https://www.notion.so/elaxenergie/GEN-1234)",
            url: "https://www.notion.so/elaxenergie/GEN-1234",
          },
        },
      ],
    });

    expect(toPrSummary(pr).statusLinks).toEqual([
      {
        name: "notion-ticket",
        label: "GEN-1234",
        url: "https://www.notion.so/elaxenergie/GEN-1234",
        type: "success",
      },
    ]);
  });

  it("falls back to the title when the summary is not a markdown link", () => {
    const pr = buildPr({
      lintStatuses: [
        {
          name: "some-rule",
          status: {
            type: "success",
            title: "✓ Deployed",
            summary: "the preview is up",
            url: "https://preview.example.com",
          },
        },
      ],
    });

    expect(toPrSummary(pr).statusLinks).toEqual([
      {
        name: "some-rule",
        label: "✓ Deployed",
        url: "https://preview.example.com",
        type: "success",
      },
    ]);
  });

  it("ignores a status without a url", () => {
    const pr = buildPr({
      lintStatuses: [
        {
          name: "lint-pr",
          status: { type: "success", title: "✓ PR is valid", summary: "" },
        },
      ],
    });

    expect(toPrSummary(pr).statusLinks).toEqual([]);
  });

  /**
   * The passing reviewflow lint is written with an explicit `url: undefined`,
   * which comes back from mongo as null rather than as a missing key.
   */
  it("ignores a status whose url came back empty", () => {
    const withNullUrl = buildPr({
      lintStatuses: [
        {
          name: "lint-pr",
          status: {
            type: "success",
            title: "✓ PR is valid",
            summary: "",
            url: null as unknown as undefined,
          },
        },
      ],
    });
    const withEmptyUrl = buildPr({
      lintStatuses: [
        {
          name: "lint-pr",
          status: {
            type: "success",
            title: "✓ PR is valid",
            summary: "",
            url: "",
          },
        },
      ],
    });

    expect(toPrSummary(withNullUrl).statusLinks).toEqual([]);
    expect(toPrSummary(withEmptyUrl).statusLinks).toEqual([]);
  });

  it("carries the type through, so a failing link stays distinguishable", () => {
    const pr = buildPr({
      lintStatuses: [
        {
          name: "lint-pr",
          status: {
            type: "failure",
            inBody: true,
            title: "Title does not match conventional commit.",
            summary: "",
            url: "https://www.conventionalcommits.org/",
          },
        },
      ],
    });

    expect(toPrSummary(pr).statusLinks).toEqual([
      {
        name: "lint-pr",
        label: "Title does not match conventional commit.",
        url: "https://www.conventionalcommits.org/",
        type: "failure",
      },
    ]);
  });
});
