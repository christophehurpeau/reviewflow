import { describe, expect, it } from "vitest";
import type { PullRequestFilesResponse } from "../api/pullRequest.ts";
import {
  pullRequestEditMovesBoard,
  pullRequestPartsStaleAfter,
  withFileViewed,
} from "./pullRequestEdit.ts";

describe("pullRequestPartsStaleAfter", () => {
  it("reads the header alone for a reaction to the description, the timeline for one to a comment", () => {
    const reaction = (subjectId: string) =>
      pullRequestPartsStaleAfter(
        { kind: "reaction", subjectId, content: "eyes", reacted: true },
        "PR_1",
      );
    expect(reaction("PR_1")).toEqual(["detail"]);
    expect(reaction("IC_1")).toEqual(["timeline"]);
  });

  it("reads the timeline alone for the conversation", () => {
    expect(
      pullRequestPartsStaleAfter({ kind: "comment", body: "x" }, "PR_1"),
    ).toEqual(["timeline"]);
  });

  it("reads nothing again for a viewed mark, applied in place instead", () => {
    expect(
      pullRequestPartsStaleAfter(
        { kind: "viewed", path: "a.ts", viewed: true },
        "PR_1",
      ),
    ).toEqual([]);
  });

  it("reads the timeline with the header for an edit GitHub lists as an event", () => {
    expect(
      pullRequestPartsStaleAfter(
        { kind: "labels", add: ["bug"], remove: [] },
        "PR_1",
      ),
    ).toEqual(["detail", "timeline"]);
  });

  it("reads everything once the branch moved", () => {
    expect(
      pullRequestPartsStaleAfter(
        { kind: "updateBranch", expectedHeadSha: "a".repeat(40) },
        "PR_1",
      ),
    ).toEqual(["detail", "checks", "timeline", "commits", "files"]);
  });
});

const files: PullRequestFilesResponse = {
  files: [
    {
      path: "a.ts",
      additions: 1,
      deletions: 0,
      change: "modified",
      viewed: "unviewed",
    },
    {
      path: "b.ts",
      additions: 2,
      deletions: 1,
      change: "modified",
      viewed: "dismissed",
    },
  ],
  viewerLastReview: { oid: "abc", submittedAt: "2026-10-18T09:00:00Z" },
  fetchedAt: "2026-10-18T10:00:00Z",
  checkedAt: "2026-10-18T10:00:00Z",
  source: "github",
  errors: [],
};

describe("withFileViewed", () => {
  it("marks one file and leaves the rest of the read as GitHub gave it", () => {
    expect(withFileViewed(files, "a.ts", true)).toEqual({
      ...files,
      files: [{ ...files.files[0], viewed: "viewed" }, files.files[1]],
    });
  });

  it("unmarks a file, and marks a dismissed one viewed again", () => {
    const marked = withFileViewed(files, "b.ts", true);
    expect(marked.files[1]?.viewed).toBe("viewed");
    expect(withFileViewed(marked, "b.ts", false).files[1]?.viewed).toBe(
      "unviewed",
    );
  });

  it("leaves the read as it is for a path it does not hold", () => {
    expect(withFileViewed(files, "past-the-first-page.ts", true)).toEqual(
      files,
    );
  });
});

describe("pullRequestEditMovesBoard", () => {
  it("refreshes the board for a state or a verdict, never for a comment or a reaction", () => {
    expect(pullRequestEditMovesBoard({ kind: "draft", draft: true })).toBe(
      true,
    );
    expect(pullRequestEditMovesBoard({ kind: "comment", body: "x" })).toBe(
      false,
    );
    expect(
      pullRequestEditMovesBoard({
        kind: "reaction",
        subjectId: "PR_1",
        content: "heart",
        reacted: true,
      }),
    ).toBe(false);
  });
});
