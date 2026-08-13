import { describe, expect, test } from "vitest";
import {
  checkIsMissingRestrictedApprobation,
  getRestrictedReviewersToRequest,
} from "./restrictedApprobation.ts";

describe("checkIsMissingRestrictedApprobation", () => {
  test("is not missing when restrictAutoMergeTo is not configured", () => {
    expect(
      checkIsMissingRestrictedApprobation({
        restrictAutoMergeTo: undefined,
        authorLogin: "renovate[bot]",
        approvedLogins: [],
      }),
    ).toBe(false);
  });

  test("is missing when only other logins approved", () => {
    expect(
      checkIsMissingRestrictedApprobation({
        restrictAutoMergeTo: ["christophehurpeau"],
        authorLogin: "renovate[bot]",
        approvedLogins: ["reviewflow[bot]"],
      }),
    ).toBe(true);
  });

  test("is missing when there is no approval", () => {
    expect(
      checkIsMissingRestrictedApprobation({
        restrictAutoMergeTo: ["christophehurpeau"],
        authorLogin: "renovate[bot]",
        approvedLogins: [],
      }),
    ).toBe(true);
  });

  test("is not missing when a restricted login approved", () => {
    expect(
      checkIsMissingRestrictedApprobation({
        restrictAutoMergeTo: ["christophehurpeau", "other"],
        authorLogin: "renovate[bot]",
        approvedLogins: ["reviewflow[bot]", "christophehurpeau"],
      }),
    ).toBe(false);
  });

  test("is not missing when the author is a restricted login", () => {
    expect(
      checkIsMissingRestrictedApprobation({
        restrictAutoMergeTo: ["christophehurpeau"],
        authorLogin: "christophehurpeau",
        approvedLogins: [],
      }),
    ).toBe(false);
  });
});

describe("getRestrictedReviewersToRequest", () => {
  test("requests nothing when restrictAutoMergeTo is not configured", () => {
    expect(
      getRestrictedReviewersToRequest({
        restrictAutoMergeTo: undefined,
        authorLogin: "renovate[bot]",
        requestedReviewerLogins: [],
      }),
    ).toEqual([]);
  });

  test("requests the restricted logins", () => {
    expect(
      getRestrictedReviewersToRequest({
        restrictAutoMergeTo: ["christophehurpeau", "other"],
        authorLogin: "renovate[bot]",
        requestedReviewerLogins: [],
      }),
    ).toEqual(["christophehurpeau", "other"]);
  });

  test("does not request the author nor an already requested reviewer", () => {
    expect(
      getRestrictedReviewersToRequest({
        restrictAutoMergeTo: ["christophehurpeau", "other", "third"],
        authorLogin: "christophehurpeau",
        requestedReviewerLogins: ["other"],
      }),
    ).toEqual(["third"]);
  });
});
