import { describe, expect, it } from "vitest";
import type { PullRequestCommit } from "@reviewflow/sdk";
import {
  commitAnchorings,
  commitsToRead,
  firstCommitAfter,
  summarizeCommits,
  touchDifferentFiles,
} from "./pull-request-commit-files.ts";

const commit = (
  oid: string,
  parentOid: string | null,
  merge = false,
): PullRequestCommit => ({
  oid,
  parentOid,
  merge,
  headline: oid,
  body: "",
  author: null,
  committedAt: "2026-11-01T00:00:00Z",
});

const chain = [commit("c1", "base"), commit("c2", "c1"), commit("c3", "c2")];

describe("commitsToRead", () => {
  it("reads the commits up to the head shown", () => {
    expect(commitsToRead({ listed: chain, total: 3, head: "c2" })).toEqual({
      kind: "available",
      commits: chain.slice(0, 2),
    });
  });

  it("offers nothing for a single commit", () => {
    expect(commitsToRead({ listed: chain, total: 3, head: "c1" })).toEqual({
      kind: "none",
    });
  });

  it("is unavailable when the head is past the commits listed", () => {
    expect(commitsToRead({ listed: chain, total: 120, head: "c9" })).toEqual({
      kind: "unavailable",
      reason: "The pull request has more commits than GitHub lists at once",
    });
    expect(commitsToRead({ listed: chain, total: 3, head: "c9" })).toEqual({
      kind: "unavailable",
      reason: "The commits listed do not lead to the head shown",
    });
  });

  it("is unavailable with a merge commit", () => {
    expect(
      commitsToRead({
        listed: [commit("c1", "base"), commit("c2", "c1", true)],
        total: 2,
        head: "c2",
      }),
    ).toEqual({
      kind: "unavailable",
      reason: "A merge commit's own diff carries what it merged in",
    });
  });

  it("is unavailable when the commits are not a chain", () => {
    expect(
      commitsToRead({
        listed: [commit("c1", "base"), commit("c2", "other")],
        total: 2,
        head: "c2",
      }),
    ).toEqual({
      kind: "unavailable",
      reason: "The commits do not follow one another",
    });
  });
});

describe("firstCommitAfter", () => {
  it("starts after the commit named", () => {
    expect(firstCommitAfter(chain, "c1")).toBe(1);
  });

  it("starts on the first commit when none or an unknown one is named", () => {
    expect(firstCommitAfter(chain, null)).toBe(0);
    expect(firstCommitAfter(chain, "rewritten")).toBe(0);
  });
});

describe("touchDifferentFiles", () => {
  it("is true when no path is in two commits", () => {
    expect(touchDifferentFiles([new Set(["a"]), new Set(["b", "c"])])).toBe(
      true,
    );
  });

  it("is false when a path is in two commits", () => {
    expect(touchDifferentFiles([new Set(["a"]), new Set(["b", "a"])])).toBe(
      false,
    );
  });
});

describe("commitAnchorings", () => {
  const pathsByCommit = [
    new Set(["only-first", "first-and-last"]),
    new Set(["only-second", "second-and-last"]),
    new Set(["first-and-last", "second-and-last", "only-last"]),
  ];

  it("anchors on the commit a path changed again later", () => {
    expect(commitAnchorings(pathsByCommit, 0)).toEqual(
      new Map([
        ["only-first", "pullRequest"],
        ["first-and-last", "commit"],
      ]),
    );
  });

  it("anchors on the head's new side a path changed earlier only", () => {
    expect(commitAnchorings(pathsByCommit, 2)).toEqual(
      new Map([
        ["first-and-last", "head"],
        ["second-and-last", "head"],
        ["only-last", "pullRequest"],
      ]),
    );
  });
});

describe("summarizeCommits", () => {
  const diffs = [
    { groups: [{ name: "packages/a" }] },
    { groups: [{ name: "" }, { name: "packages/b" }] },
    { groups: [{ name: "packages/c" }] },
  ];
  const pathsByCommit = [
    new Set(["a1"]),
    new Set(["r", "b1", "b2"]),
    new Set(["c1", "c2"]),
  ];

  it("summarizes every commit when none is left out", () => {
    expect(summarizeCommits({ diffs, pathsByCommit, sinceIndex: 0 })).toEqual([
      { workspaces: ["packages/a"], files: 1 },
      { workspaces: ["Root", "packages/b"], files: 3 },
      { workspaces: ["packages/c"], files: 2 },
    ]);
  });

  it("aligns the summaries with the commits stepped through since a review", () => {
    expect(summarizeCommits({ diffs, pathsByCommit, sinceIndex: 1 })).toEqual([
      { workspaces: ["Root", "packages/b"], files: 3 },
      { workspaces: ["packages/c"], files: 2 },
    ]);
  });
});
