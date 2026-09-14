import { describe, expect, it } from "vitest";
import {
  prBucketDisplay,
  prBucketsInGroup,
  prBucketsInOrder,
} from "./prBucketDisplay.ts";

describe("prBucketsInOrder", () => {
  it("covers every bucket exactly once", () => {
    expect(prBucketsInOrder.toSorted()).toEqual(
      Object.keys(prBucketDisplay).toSorted(),
    );
  });

  it("asks for the reviews the viewer already went through first", () => {
    expect(prBucketsInOrder.indexOf("re-requested-reviews")).toBeLessThan(
      prBucketsInOrder.indexOf("requested-reviews"),
    );
  });

  it("groups the buckets requesting attention before the ones in progress", () => {
    const groups = prBucketsInOrder.map(
      (bucket) => prBucketDisplay[bucket].group,
    );
    expect(groups).toEqual([
      ...groups.filter((group) => group === "requesting-attention"),
      ...groups.filter((group) => group === "in-progress"),
    ]);
  });
});

describe("prBucketsInGroup", () => {
  it("splits every bucket between the two groups", () => {
    expect([
      ...prBucketsInGroup("requesting-attention"),
      ...prBucketsInGroup("in-progress"),
    ]).toEqual(prBucketsInOrder);
  });
});

describe("prBucketDisplay", () => {
  it("names the reviewer as the one asked, on the buckets that are on them", () => {
    for (const bucket of prBucketsInGroup("requesting-attention")) {
      expect(prBucketDisplay[bucket].rowOptions.reviewRequestVerb).toBe(
        "requested",
      );
    }
  });

  it("leaves the verb awaited on the viewer's own pull requests", () => {
    for (const bucket of prBucketsInGroup("in-progress")) {
      expect(
        prBucketDisplay[bucket].rowOptions.reviewRequestVerb,
      ).toBeUndefined();
    }
  });

  it("does not repeat what a section title already states", () => {
    expect(prBucketDisplay.drafts.rowOptions.showDraft).toBe(false);
    expect(
      prBucketDisplay["re-requested-reviews"].rowOptions.showReRequests,
    ).toBe(false);
    expect(
      prBucketDisplay["changes-requested"].rowOptions.showPassedChecks,
    ).toBe(false);
  });
});
