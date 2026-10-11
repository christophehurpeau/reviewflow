import { describe, expect, test } from "vitest";
import type { CodeReviewStepState } from "./codeReviewStep.ts";
import { toReviewState } from "./reviewState.ts";

const base: CodeReviewStepState = {
  state: "not-started",
  hasRequestedReviewers: false,
  hasRequestedTeams: false,
  hasChangesRequested: false,
  hasApprovals: false,
  isMissingReview: false,
  isMissingApprobation: false,
  isMissingRestrictedApprobation: false,
  isApproved: false,
};

describe("toReviewState", () => {
  test.each<[string, Partial<CodeReviewStepState>, string]>([
    ["nothing happened", {}, "none"],
    ["no approval needed and no request", { state: "passed" }, "none"],
    [
      "approval required and none given",
      { isMissingApprobation: true },
      "none",
    ],
    [
      "reviewers requested",
      { hasRequestedReviewers: true, state: "in-progress" },
      "requested",
    ],
    [
      "teams requested",
      { hasRequestedTeams: true, state: "in-progress" },
      "requested",
    ],
    [
      "approved",
      { hasApprovals: true, isApproved: true, state: "passed" },
      "approved",
    ],
    [
      "approved with a pending re-request",
      { hasApprovals: true, hasRequestedReviewers: true },
      "requested",
    ],
    [
      "approved but the restricted approval is missing",
      {
        hasApprovals: true,
        isMissingApprobation: true,
        isMissingRestrictedApprobation: true,
        state: "in-progress",
      },
      "requested",
    ],
    [
      "changes requested with a pending request",
      {
        hasChangesRequested: true,
        hasRequestedReviewers: true,
        state: "failed",
      },
      "changesRequested",
    ],
    [
      "changes requested and an approval",
      { hasChangesRequested: true, hasApprovals: true, state: "failed" },
      "changesRequested",
    ],
  ])("%s", (_name, overrides, expected) => {
    expect(toReviewState({ ...base, ...overrides })).toBe(expected);
  });
});
