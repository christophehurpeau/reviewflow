import { describe, expect, it } from "vitest";
import { shouldIgnoreRepo } from "../context/repoContext.ts";
import ornikarConfig from "./ornikar.ts";

describe("ignoreRepoPattern", () => {
  it("should ignore some repositories", () => {
    expect(shouldIgnoreRepo("shared-config", ornikarConfig)).toBe(false);
    expect(shouldIgnoreRepo("infra-config", ornikarConfig)).toBe(true);
    expect(shouldIgnoreRepo("devenv", ornikarConfig)).toBe(true);
  });
});

describe("parsePR.body", () => {
  it("should fail with empty description", () => {
    expect(
      ornikarConfig.parsePR?.body?.[0]?.createStatusInfo(
        ["", ""],
        {} as any,
        false,
      ),
    ).toEqual({
      summary: "The PR body should not be empty",
      title: "Body is empty",
      type: "failure",
    });
  });
  it("should success with not empty description", () => {
    expect(
      ornikarConfig.parsePR?.body?.[0]?.createStatusInfo(
        ["", "something"],
        {} as any,
        false,
      ),
    ).toEqual(null);
  });
  it("should fail on empty template description", () => {
    expect(
      ornikarConfig.parsePR?.body?.[0]?.createStatusInfo(
        [
          "",
          `### Context

    <!-- Explain here why this PR is needed -->

    ### Solution

    <!-- Explain here the solution you chose for this -->

    <!-- Uncomment this if you need a testing plan
    ### Testing plan
    - [ ] Test this
    - [ ] Test that
    -->`,
        ],
        {} as any,
        false,
      ),
    ).toEqual({
      type: "failure",
      title: "Body has no meaningful content",
      summary: "The PR body should not contains only titles and comments",
    });
  });
  it("should success on filled template description", () => {
    expect(
      ornikarConfig.parsePR?.body?.[0]?.createStatusInfo(
        [
          "",
          `### Context

    This is the context

    ### Solution

    This is the solution

    <!-- Uncomment this if you need a testing plan
    ### Testing plan
    - [ ] Test this
    - [ ] Test that
    -->`,
        ],
        {} as any,
        false,
      ),
    ).toEqual(null);
  });
});
