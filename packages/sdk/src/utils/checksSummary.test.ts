import { describe, expect, it } from "vitest";
import { checksSummary } from "./checksSummary.ts";

describe("checksSummary", () => {
  it("counts nothing without checks", () => {
    expect(checksSummary([])).toEqual({ failed: 0, passed: 0, pending: 0 });
  });

  it("counts each outcome", () => {
    expect(
      checksSummary([
        { outcome: "failed" },
        { outcome: "passed" },
        { outcome: "pending" },
        { outcome: "passed" },
        { outcome: "passed" },
      ]),
    ).toEqual({ failed: 1, passed: 3, pending: 1 });
  });
});
