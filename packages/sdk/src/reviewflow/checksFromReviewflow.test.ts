import { describe, expect, it } from "vitest";
import { checksFromReviewflow } from "./checksFromReviewflow.ts";

describe("checksFromReviewflow", () => {
  it("reads lowercase REST values as GitHub's checks, failures first", () => {
    const response = checksFromReviewflow(
      {
        checkRuns: [
          {
            name: "build",
            status: "completed",
            conclusion: "success",
            title: "ok",
            detailsUrl: "https://ci/1",
          },
          {
            name: "test",
            status: "in_progress",
            conclusion: null,
            title: null,
            detailsUrl: null,
          },
          {
            name: "old",
            status: null,
            conclusion: "failure",
            title: "",
            detailsUrl: null,
          },
        ],
        statuses: [
          {
            context: "ci/legacy",
            state: "pending",
            description: "waiting",
            targetUrl: null,
          },
        ],
      },
      "2026-11-06T10:00:00.000Z",
    );
    expect(response.source).toBe("reviewflow");
    expect(response.errors).toEqual([]);
    expect(response.checksTotal).toBe(4);
    expect(response.fetchedAt).toBe("2026-11-06T10:00:00.000Z");
    expect(response.checkedAt).toBe("2026-11-06T10:00:00.000Z");
    expect(
      response.checks.map(({ name, outcome, running }) => ({
        name,
        outcome,
        running,
      })),
    ).toEqual([
      { name: "old", outcome: "failed", running: false },
      { name: "test", outcome: "pending", running: true },
      { name: "ci/legacy", outcome: "pending", running: false },
      { name: "build", outcome: "passed", running: false },
    ]);
  });

  it("reads no check at all", () => {
    const response = checksFromReviewflow(
      { checkRuns: [], statuses: [] },
      "2026-11-06T10:00:00.000Z",
    );
    expect(response.checks).toEqual([]);
    expect(response.checksTotal).toBe(0);
  });
});
