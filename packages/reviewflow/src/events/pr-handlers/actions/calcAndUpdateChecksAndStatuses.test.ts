import { describe, expect, it } from "vitest";
import type { ReviewflowPr } from "reviewflow-core";
import type { RepoContext } from "../../../context/repoContext.ts";
import { getChecksAndStatusesState } from "./calcAndUpdateChecksAndStatuses.ts";

const repoContext: RepoContext = { config: {} } as unknown as RepoContext;

const buildPr = (overrides: Partial<ReviewflowPr>): ReviewflowPr =>
  ({
    checksConclusion: {},
    statusesConclusion: {},
    ...overrides,
  }) as unknown as ReviewflowPr;

describe("getChecksAndStatusesState", () => {
  it("reports nothing when the pull request has no conclusion recorded", () => {
    expect(
      getChecksAndStatusesState(
        buildPr({ checksConclusion: undefined }),
        repoContext,
      ),
    ).toBeUndefined();
    expect(
      getChecksAndStatusesState(
        buildPr({ statusesConclusion: undefined }),
        repoContext,
      ),
    ).toBeUndefined();
  });

  it("passes once everything settled without failure", () => {
    const pr = buildPr({
      checksConclusion: { a: { name: "build", conclusion: "success" } },
      statusesConclusion: { b: { context: "netlify", state: "success" } },
    });

    expect(getChecksAndStatusesState(pr, repoContext)).toBe("passed");
  });

  it("fails as soon as one check failed", () => {
    const pr = buildPr({
      checksConclusion: {
        a: { name: "build", conclusion: "failure" },
        b: { name: "test", conclusion: "success" },
      },
    });

    expect(getChecksAndStatusesState(pr, repoContext)).toBe("failed");
  });

  it("pends while a check has not concluded", () => {
    const pr = buildPr({
      checksConclusion: { a: { name: "build", conclusion: null } },
    });

    expect(getChecksAndStatusesState(pr, repoContext)).toBe("pending");
  });

  /**
   * The home only republishes on a transition, so a check event that leaves the
   * state alone must compare equal — that is what keeps a busy repo from
   * queueing dozens of renders for one pull request.
   */
  it("stays equal when another check succeeds alongside a failure", () => {
    const before = buildPr({
      checksConclusion: { a: { name: "build", conclusion: "failure" } },
    });
    const after = buildPr({
      checksConclusion: {
        a: { name: "build", conclusion: "failure" },
        b: { name: "test", conclusion: "success" },
      },
    });

    expect(getChecksAndStatusesState(after, repoContext)).toBe(
      getChecksAndStatusesState(before, repoContext),
    );
  });

  it("changes when the last pending check fails", () => {
    const before = buildPr({
      checksConclusion: { a: { name: "build", conclusion: null } },
    });
    const after = buildPr({
      checksConclusion: { a: { name: "build", conclusion: "failure" } },
    });

    expect(getChecksAndStatusesState(before, repoContext)).toBe("pending");
    expect(getChecksAndStatusesState(after, repoContext)).toBe("failed");
  });
});
