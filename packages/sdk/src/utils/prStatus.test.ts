import { describe, expect, it } from "vitest";
import type { PrReviewDecision, PrState } from "../types/entities.ts";
import {
  prHasConflicts,
  prNumberOf,
  prStatus,
  prStatusLabels,
  prUrl,
} from "./prStatus.ts";

describe("prNumberOf", () => {
  it("reads a number, a #number and a url of the repository", () => {
    expect(prNumberOf(" 67 ", "owner/repo")).toBe(67);
    expect(prNumberOf("#67", "owner/repo")).toBe(67);
    expect(
      prNumberOf("https://github.com/Owner/Repo/pull/67/files", "owner/repo"),
    ).toBe(67);
  });

  it("refuses another repository's url and text naming no pull request", () => {
    expect(
      prNumberOf("https://github.com/other/repo/pull/67", "owner/repo"),
    ).toBe("that pull request is not in owner/repo");
    expect(prNumberOf("feat/branch", "owner/repo")).toBeTypeOf("string");
    expect(prNumberOf("0", "owner/repo")).toBeTypeOf("string");
    expect(
      prNumberOf("https://github.com/owner/repo/issues/67", "owner/repo"),
    ).toBeTypeOf("string");
  });
});

const status = (state: PrState, reviewDecision: PrReviewDecision = null) =>
  prStatus({ state, reviewDecision });

describe("prStatus", () => {
  /**
   * "open" is never shown: it says nothing the branch did not already say, and
   * where the review stands is the whole question.
   */
  it("describes an open pull request by where its review stands", () => {
    expect(status("open", "approved")).toBe("approved");
    expect(status("open", "changesRequested")).toBe("changesRequested");
    expect(status("open", "reviewRequired")).toBe("waitingReview");
  });

  /**
   * A real distinction: nothing was required and nobody was asked — nobody is
   * coming — against a required review that is somebody else's turn.
   */
  it("tells no reviewers apart from waiting review", () => {
    expect(status("open", null)).toBe("noReviewers");
    expect(status("open", "reviewRequired")).toBe("waitingReview");
  });

  it("keeps draft, merged and closed whatever the last review said", () => {
    expect(status("draft", "reviewRequired")).toBe("draft");
    expect(status("merged", "approved")).toBe("merged");
    expect(status("closed", "approved")).toBe("closed");
  });

  it("labels every status without leaving a camelCase one visible", () => {
    for (const label of Object.values(prStatusLabels)) {
      expect(label).toMatch(/^[a-z]+( [a-z]+)*$/u);
    }
  });
});

describe("prUrl", () => {
  it("builds the pull request url from the repo and the number", () => {
    expect(prUrl("owner/repo", 42)).toBe(
      "https://github.com/owner/repo/pull/42",
    );
  });
});

describe("prHasConflicts", () => {
  it("flags a conflicting pull request that can still be merged", () => {
    expect(prHasConflicts({ state: "open", mergeable: "conflicting" })).toBe(
      true,
    );
    expect(prHasConflicts({ state: "draft", mergeable: "conflicting" })).toBe(
      true,
    );
  });

  it("ignores a finished one, and one GitHub has not computed", () => {
    expect(prHasConflicts({ state: "closed", mergeable: "conflicting" })).toBe(
      false,
    );
    expect(prHasConflicts({ state: "open", mergeable: "unknown" })).toBe(false);
  });
});
