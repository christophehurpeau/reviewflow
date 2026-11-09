import { describe, expect, it } from "vitest";
import type { ReviewflowBoardPr } from "./board.ts";
import type { BoardFilters } from "./boardFilters.ts";
import {
  buildBoardFilterOptions,
  defaultBoardFilters,
  hasActiveBoardFilters,
  matchesBoardFilters,
  parseBoardFilters,
  toBoardFilterParams,
  withBoardFilterAccount,
} from "./boardFilters.ts";

const pr = (overrides: Partial<ReviewflowBoardPr> = {}): ReviewflowBoardPr => ({
  id: "1",
  ownerRepo: "Acme/api",
  number: 1,
  title: "A change",
  url: "https://github.com/acme/api/pull/1",
  headRef: "feat/a",
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
  requestedReviewers: [],
  reRequestedReviewers: [],
  requestedTeams: [],
  assignees: [],
  statusLinks: [],
  changes: null,
  openedAt: null,
  approvedAt: null,
  closedAt: null,
  labels: ["bug"],
  unresolvedThreads: null,
  mergeable: "mergeable",
  updatedAt: "2026-11-06T09:30:00.000Z",
  ...overrides,
});

const filtersOf = (overrides: Partial<BoardFilters>): BoardFilters => ({
  ...defaultBoardFilters,
  ...overrides,
});

describe("matchesBoardFilters", () => {
  it("matches everything by default", () => {
    expect(matchesBoardFilters(pr(), defaultBoardFilters)).toBe(true);
  });

  it("filters on the account and repository, whatever their case", () => {
    expect(matchesBoardFilters(pr(), filtersOf({ account: "acme" }))).toBe(
      true,
    );
    expect(matchesBoardFilters(pr(), filtersOf({ account: "globex" }))).toBe(
      false,
    );
    expect(matchesBoardFilters(pr(), filtersOf({ repo: "acme/API" }))).toBe(
      true,
    );
    expect(matchesBoardFilters(pr(), filtersOf({ repo: "acme/web" }))).toBe(
      false,
    );
  });

  it("filters on the author, which an old pull request does not have", () => {
    expect(matchesBoardFilters(pr(), filtersOf({ author: "ada" }))).toBe(true);
    expect(
      matchesBoardFilters(pr({ author: null }), filtersOf({ author: "ada" })),
    ).toBe(false);
  });

  it("tells drafts from pull requests ready for review", () => {
    const draft = pr({ state: "draft" });

    expect(matchesBoardFilters(draft, filtersOf({ draft: "draft" }))).toBe(
      true,
    );
    expect(matchesBoardFilters(draft, filtersOf({ draft: "ready" }))).toBe(
      false,
    );
    expect(matchesBoardFilters(pr(), filtersOf({ draft: "ready" }))).toBe(true);
  });

  it.each([
    ["success", "passed"],
    ["failed", "failed"],
    ["none", "unknown"],
  ] as const)("reads checks %s as the %s conclusion", (checks, conclusion) => {
    expect(
      matchesBoardFilters(
        pr({ checksConclusion: conclusion }),
        filtersOf({ checks }),
      ),
    ).toBe(true);
    expect(
      matchesBoardFilters(
        pr({ checksConclusion: "inProgress" }),
        filtersOf({ checks }),
      ),
    ).toBe(false);
  });
});

describe("matchesBoardFilters, on what the row says", () => {
  it.each(["a change", "A CHANGE", "feat/a", "1", "#1"])(
    "finds %s in the title, the branch or the number",
    (search) => {
      expect(matchesBoardFilters(pr(), filtersOf({ search }))).toBe(true);
    },
  );

  it("does not find what is in none of them", () => {
    expect(matchesBoardFilters(pr(), filtersOf({ search: "#12" }))).toBe(false);
  });

  it("filters on the review state, unknown matching none", () => {
    expect(matchesBoardFilters(pr(), filtersOf({ review: "requested" }))).toBe(
      true,
    );
    expect(matchesBoardFilters(pr(), filtersOf({ review: "approved" }))).toBe(
      false,
    );
    expect(
      matchesBoardFilters(
        pr({ reviewState: null }),
        filtersOf({ review: "requested" }),
      ),
    ).toBe(false);
  });

  it("filters on a label", () => {
    expect(matchesBoardFilters(pr(), filtersOf({ label: "bug" }))).toBe(true);
    expect(matchesBoardFilters(pr(), filtersOf({ label: "feature" }))).toBe(
      false,
    );
  });
});

describe("url parameters", () => {
  it("falls back to the defaults on what it does not know", () => {
    expect(
      parseBoardFilters({
        state: "gone",
        draft: "maybe",
        checks: "green",
        review: "none",
      }),
    ).toEqual(defaultBoardFilters);
  });

  it("round-trips the filters, leaving the defaults out", () => {
    const filters: BoardFilters = {
      state: "closed",
      account: "acme",
      repo: "acme/api",
      author: "ada",
      draft: "ready",
      checks: "none",
      search: "retry",
      review: "approved",
      label: "bug",
    };

    expect(parseBoardFilters(toBoardFilterParams(filters))).toEqual(filters);
    expect(toBoardFilterParams(defaultBoardFilters)).toEqual({});
  });
});

describe("hasActiveBoardFilters", () => {
  it("does not count the open/closed view", () => {
    expect(hasActiveBoardFilters(filtersOf({ state: "closed" }))).toBe(false);
    expect(hasActiveBoardFilters(filtersOf({ checks: "none" }))).toBe(true);
  });
});

describe("buildBoardFilterOptions", () => {
  const rows = [
    pr(),
    pr({ ownerRepo: "globex/web", author: "linus" }),
    pr({ author: null }),
  ];

  it("lists each repository and author once, sorted", () => {
    expect(buildBoardFilterOptions(rows, defaultBoardFilters)).toEqual({
      repos: ["Acme/api", "globex/web"],
      authors: ["ada", "linus"],
      labels: ["bug"],
    });
  });

  it("narrows to the selected account", () => {
    expect(
      buildBoardFilterOptions(rows, filtersOf({ account: "globex" })),
    ).toEqual({ repos: ["globex/web"], authors: ["linus"], labels: ["bug"] });
  });

  it("keeps what is selected when no row carries it anymore", () => {
    expect(
      buildBoardFilterOptions(
        [],
        filtersOf({ repo: "acme/gone", author: "ghost", label: "old" }),
      ),
    ).toEqual({ repos: ["acme/gone"], authors: ["ghost"], labels: ["old"] });
  });
});

describe("withBoardFilterAccount", () => {
  const filters = filtersOf({ repo: "acme/api" });

  it("forgets a repository of another account", () => {
    expect(withBoardFilterAccount(filters, "globex")).toEqual(
      filtersOf({ account: "globex", repo: null }),
    );
  });

  it("forgets a repository once no account is selected", () => {
    expect(withBoardFilterAccount(filters, null).repo).toBe(null);
  });

  it("keeps a repository of that account", () => {
    expect(withBoardFilterAccount(filters, "acme").repo).toBe("acme/api");
  });
});
