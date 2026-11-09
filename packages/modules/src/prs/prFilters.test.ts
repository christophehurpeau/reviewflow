import { describe, expect, it } from "vitest";
import type { PrSummary } from "./Pr.ts";
import {
  buildPrFilterOptions,
  hasActivePrFilters,
  matchesPrFilters,
  parsePrFilters,
  parsePrStateFilter,
  prFiltersForAccount,
  toPrFilterParams,
} from "./prFilters.ts";

const pr = (overrides: Partial<PrSummary> = {}): PrSummary => ({
  _id: "1",
  orgLogin: "acme",
  repoName: "api",
  number: 1,
  title: "A change",
  url: "https://github.com/acme/api/pull/1",
  headRef: "feat/retry",
  isDraft: false,
  checks: { conclusion: "passed", runningCount: 0, failedNames: [] },
  lintFailed: false,
  statusLinks: [],
  labels: [{ id: 1, name: "bug" }],
  reviewState: "requested",
  approvedBy: [],
  changesRequestedBy: [],
  requestedReviewers: [],
  reRequestedReviewers: [],
  requestedTeams: [],
  assignees: [],
  creator: { id: 1, login: "ada" },
  unresolvedThreads: null,
  ...overrides,
});

describe("matchesPrFilters", () => {
  it("matches everything without a filter", () => {
    expect(matchesPrFilters(pr(), {})).toBe(true);
  });

  it("filters on the repository as owner/name", () => {
    expect(matchesPrFilters(pr(), { repo: "acme/api" })).toBe(true);
    expect(matchesPrFilters(pr(), { repo: "acme/web" })).toBe(false);
  });

  it("filters on the author, which an old pull request does not have", () => {
    expect(matchesPrFilters(pr(), { author: "ada" })).toBe(true);
    expect(matchesPrFilters(pr(), { author: "linus" })).toBe(false);
    expect(
      matchesPrFilters(pr({ creator: undefined }), { author: "ada" }),
    ).toBe(false);
  });

  it("tells drafts from pull requests ready for review", () => {
    expect(matchesPrFilters(pr({ isDraft: true }), { draft: "draft" })).toBe(
      true,
    );
    expect(matchesPrFilters(pr({ isDraft: true }), { draft: "ready" })).toBe(
      false,
    );
    expect(matchesPrFilters(pr(), { draft: "ready" })).toBe(true);
  });

  it.each([
    ["success", "passed"],
    ["failed", "failed"],
    ["none", "unknown"],
  ] as const)("reads checks %s as the %s conclusion", (checks, conclusion) => {
    const matching = pr({
      checks: { conclusion, runningCount: 0, failedNames: [] },
    });
    const running = pr({
      checks: { conclusion: "in-progress", runningCount: 1, failedNames: [] },
    });

    expect(matchesPrFilters(matching, { checks })).toBe(true);
    expect(matchesPrFilters(running, { checks })).toBe(false);
  });

  it.each(["a change", "A CHANGE", "retry", "1", "#1"])(
    "finds %s in the title, the branch or the number",
    (search) => {
      expect(matchesPrFilters(pr(), { search })).toBe(true);
    },
  );

  it("does not find what is in none of them", () => {
    expect(matchesPrFilters(pr(), { search: "#12" })).toBe(false);
    expect(matchesPrFilters(pr({ headRef: null }), { search: "retry" })).toBe(
      false,
    );
  });

  it("filters on the review state", () => {
    expect(matchesPrFilters(pr(), { review: "requested" })).toBe(true);
    expect(matchesPrFilters(pr(), { review: "approved" })).toBe(false);
    expect(
      matchesPrFilters(pr({ reviewState: null }), { review: "requested" }),
    ).toBe(false);
  });

  it("filters on a label", () => {
    expect(matchesPrFilters(pr(), { label: "bug" })).toBe(true);
    expect(matchesPrFilters(pr(), { label: "feature" })).toBe(false);
  });

  it("requires every filter to match", () => {
    expect(matchesPrFilters(pr(), { repo: "acme/api", author: "linus" })).toBe(
      false,
    );
  });
});

describe("url parameters", () => {
  it("reads the open pull requests unless asked for the closed ones", () => {
    expect(parsePrStateFilter("closed")).toBe("closed");
    expect(parsePrStateFilter(undefined)).toBe("open");
    expect(parsePrStateFilter("anything")).toBe("open");
  });

  it("drops the values it does not know", () => {
    expect(
      parsePrFilters({
        draft: "maybe",
        checks: "green",
        review: "none",
      }),
    ).toEqual({});
  });

  it("round-trips the filters, leaving the defaults out", () => {
    const filters = {
      repo: "acme/api",
      author: "ada",
      draft: "ready",
      checks: "none",
      search: "retry",
      review: "changesRequested",
      label: "bug",
    } as const;

    expect(parsePrFilters(toPrFilterParams("open", filters))).toEqual(filters);
    expect(toPrFilterParams("open", {})).toEqual({});
    expect(toPrFilterParams("closed", {})).toEqual({ state: "closed" });
  });
});

describe("hasActivePrFilters", () => {
  it("is off without a filter and on with any", () => {
    expect(hasActivePrFilters({})).toBe(false);
    expect(hasActivePrFilters({ checks: "none" })).toBe(true);
  });
});

describe("buildPrFilterOptions", () => {
  it("lists each repository and author once, sorted", () => {
    expect(
      buildPrFilterOptions(
        [
          pr({ repoName: "web", creator: { id: 2, login: "linus" } }),
          pr(),
          pr({ creator: undefined }),
        ],
        {},
      ),
    ).toEqual({
      repos: ["acme/api", "acme/web"],
      authors: ["ada", "linus"],
      labels: ["bug"],
    });
  });

  it("keeps what is selected when no row carries it anymore", () => {
    expect(
      buildPrFilterOptions([], {
        repo: "acme/gone",
        author: "ghost",
        label: "old",
      }),
    ).toEqual({ repos: ["acme/gone"], authors: ["ghost"], labels: ["old"] });
  });
});

describe("prFiltersForAccount", () => {
  it("forgets a repository of another account", () => {
    expect(
      prFiltersForAccount({ repo: "acme/api", author: "ada" }, "globex"),
    ).toEqual({ repo: undefined, author: "ada" });
  });

  it("keeps a repository of that account, and any on all accounts", () => {
    const filters = { repo: "acme/api" };

    expect(prFiltersForAccount(filters, "acme")).toBe(filters);
    expect(prFiltersForAccount(filters, undefined)).toBe(filters);
  });
});
