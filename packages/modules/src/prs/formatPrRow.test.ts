import { describe, expect, it } from "vitest";
import type { PrSummary } from "./Pr.ts";
import {
  formatPrChanges,
  formatPrFlowDate,
  selectPrRowStatus,
} from "./formatPrRow.ts";

const createPrSummary = (overrides: Partial<PrSummary> = {}): PrSummary => ({
  _id: "1",
  orgLogin: "org",
  repoName: "repo",
  number: 1,
  title: "My PR",
  url: "https://github.com/org/repo/pull/1",
  isDraft: false,
  checks: { conclusion: "unknown", runningCount: 0, failedNames: [] },
  lintFailed: false,
  statusLinks: [],
  approvedBy: [],
  changesRequestedBy: [],
  requestedReviewers: [],
  reRequestedReviewers: [],
  requestedTeams: [],
  assignees: [],
  ...overrides,
});

describe("formatPrChanges", () => {
  /** a `·` here would read as one more segment of the line it sits on */
  it("keeps the diff inside a single segment", () => {
    expect(
      formatPrChanges({ changedFiles: 5, additions: 120, deletions: 8 }),
    ).toBe("5 files (+120 −8)");
  });

  it("singularises a one file change", () => {
    expect(
      formatPrChanges({ changedFiles: 1, additions: 2, deletions: 0 }),
    ).toBe("1 file (+2 −0)");
  });
});

describe("formatPrFlowDate", () => {
  it("reports the approval over the opening", () => {
    expect(
      formatPrFlowDate({
        openedAt: new Date("2020-01-01T00:00:00Z"),
        approvedAt: new Date("2020-01-02T09:12:00Z"),
      }),
    ).toBe("approved Jan 2, 2020, 9:12 AM");
  });

  it("reports the opening on its own", () => {
    expect(
      formatPrFlowDate({ openedAt: new Date("2020-01-01T00:00:00Z") }),
    ).toBe("opened Jan 1, 2020, 12:00 AM");
  });

  it("says nothing without a date", () => {
    expect(formatPrFlowDate({})).toBeUndefined();
  });
});

describe("selectPrRowStatus", () => {
  it("says nothing about a pull request nothing happened to", () => {
    expect(selectPrRowStatus(createPrSummary())).toEqual({
      failed: "",
      changesRequested: undefined,
      isDraft: false,
      rest: "",
    });
  });

  it("separates what broke from what the row merely states", () => {
    const status = selectPrRowStatus(
      createPrSummary({
        isDraft: true,
        lintFailed: true,
        checks: {
          conclusion: "failed",
          runningCount: 0,
          failedNames: ["ci/build", "ci/test"],
        },
        changesRequestedBy: [{ id: 1, login: "erin" }],
        approvedBy: [{ id: 2, login: "dan" }],
        requestedReviewers: [{ id: 3, login: "bob" }],
        requestedTeams: ["core"],
        reRequestedReviewers: [{ id: 4, login: "carol" }],
      }),
      { currentUserLogin: "bob", reviewRequestVerb: "requested" },
    );

    expect(status).toEqual({
      failed: "checks failed: ci/build, ci/test · pr lint failed",
      changesRequested: "changes requested by @erin",
      isDraft: true,
      rest: "approved by @dan · requested you, @carol, #core",
    });
  });

  it("names the viewer as themselves", () => {
    const status = selectPrRowStatus(
      createPrSummary({ approvedBy: [{ id: 1, login: "bob" }] }),
      { currentUserLogin: "bob", selfLabel: "_you_" },
    );

    expect(status.rest).toBe("approved by _you_");
  });

  it("wraps a check name the way the surface renders code", () => {
    const status = selectPrRowStatus(
      createPrSummary({
        checks: {
          conclusion: "failed",
          runningCount: 0,
          failedNames: ["lint"],
        },
      }),
      { wrapCheckName: (name) => `\`${name}\`` },
    );

    expect(status.failed).toBe("check failed: `lint`");
  });

  it("caps the failed check names it lists", () => {
    const status = selectPrRowStatus(
      createPrSummary({
        checks: {
          conclusion: "failed",
          runningCount: 0,
          failedNames: Array.from({ length: 12 }, (_, index) => `c${index}`),
        },
      }),
    );

    expect(status.failed).toBe(
      "checks failed: c0, c1, c2, c3, c4, c5, c6, c7, c8 +3",
    );
  });

  /** the section title already states what these repeat */
  it("drops what the section it sits under already says", () => {
    const pr = createPrSummary({
      isDraft: true,
      checks: { conclusion: "passed", runningCount: 0, failedNames: [] },
      reRequestedReviewers: [{ id: 1, login: "carol" }],
    });

    expect(
      selectPrRowStatus(pr, {
        showDraft: false,
        showPassedChecks: false,
        showReRequests: false,
      }),
    ).toEqual({
      failed: "",
      changesRequested: undefined,
      isDraft: false,
      rest: "",
    });
  });

  it("counts the checks still running", () => {
    const status = selectPrRowStatus(
      createPrSummary({
        checks: { conclusion: "in-progress", runningCount: 3, failedNames: [] },
      }),
    );

    expect(status.rest).toBe("3 checks running");
  });

  it("asks for a review of the teams alone", () => {
    const status = selectPrRowStatus(
      createPrSummary({ requestedTeams: ["core", "infra"] }),
    );

    expect(status.rest).toBe("awaiting #core, #infra");
  });
});
