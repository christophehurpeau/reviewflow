import { describe, expect, it } from "vitest";
import type { ReviewflowPrDetail } from "@reviewflow/sdk";
import { settledCandidateOf } from "./settledPullRequests.ts";

const sha = "a".repeat(40);

const pr = (overrides: Partial<ReviewflowPrDetail>): ReviewflowPrDetail =>
  // oxlint-disable-next-line typescript/consistent-type-assertions
  ({
    number: 12,
    title: "Add the widget",
    headSha: sha,
    baseRef: "main",
    state: "merged",
    author: "alice",
    updatedAt: "2026-11-01T10:00:00.000Z",
    closedAt: "2026-11-01T09:00:00.000Z",
    ...overrides,
  }) as ReviewflowPrDetail;

describe("settledCandidateOf", () => {
  it("reads a merged pull request, its close as its merge", () => {
    expect(settledCandidateOf({ found: true, pr: pr({}) })).toEqual({
      number: 12,
      title: "Add the widget",
      state: "MERGED",
      isDraft: false,
      sha,
      baseRefName: "main",
      author: "alice",
      updatedAt: "2026-11-01T10:00:00.000Z",
      mergedAt: "2026-11-01T09:00:00.000Z",
      closedAt: "2026-11-01T09:00:00.000Z",
      commitOids: [],
    });
  });

  it("reads a closed pull request, never merged", () => {
    expect(
      settledCandidateOf({ found: true, pr: pr({ state: "closed" }) }),
    ).toMatchObject({ state: "CLOSED", mergedAt: null });
  });

  it("leaves out an open one, one without a state or a head, and a branch reviewflow cannot answer", () => {
    expect(
      settledCandidateOf({ found: true, pr: pr({ state: "open" }) }),
    ).toBeNull();
    expect(
      settledCandidateOf({ found: true, pr: pr({ state: "draft" }) }),
    ).toBeNull();
    expect(
      settledCandidateOf({ found: true, pr: pr({ state: null }) }),
    ).toBeNull();
    expect(
      settledCandidateOf({ found: true, pr: pr({ headSha: null }) }),
    ).toBeNull();
    expect(settledCandidateOf({ found: false, reason: "noPr" })).toBeNull();
  });
});
