import { describe, expect, it } from "vitest";
import {
  parseBranchPullRequests,
  parseOpenPullRequests,
} from "../github/openPullRequests.ts";
import type { CheckoutBranch, OpenPullRequest } from "./overview.ts";
import { pullRequestOfBranch, pullRequestsWithoutBranch } from "./overview.ts";

const pullRequest = (
  number: number,
  headRefName: string,
  headOwnerRepo: string | null,
): OpenPullRequest => ({
  number,
  title: `PR ${String(number)}`,
  isDraft: false,
  headRefName,
  headOwnerRepo,
  author: "alice",
  updatedAt: "2026-11-08T10:00:00.000Z",
});

const branch = (name: string): CheckoutBranch => ({
  name,
  sha: "a".repeat(40),
  upstream: null,
  ahead: null,
  behind: null,
  upstreamGone: false,
  merged: false,
  worktreePath: null,
  lastCommit: { subject: "x", committedAt: "2026-11-08T10:00:00.000Z" },
});

const own = pullRequest(1, "feat/x", "Acme/Widgets");
const fork = pullRequest(2, "feat/x", "someone/widgets");
const remoteOnly = pullRequest(3, "fix/y", "acme/widgets");

describe("pullRequestOfBranch", () => {
  it("matches the head branch of this repository only, whatever the case of its name", () => {
    expect(
      pullRequestOfBranch([fork, own], "acme/widgets", "feat/x")?.number,
    ).toBe(1);
    expect(pullRequestOfBranch([fork], "acme/widgets", "feat/x")).toBeNull();
  });
});

describe("pullRequestsWithoutBranch", () => {
  it("keeps a fork's namesake and a branch never checked out", () => {
    expect(
      pullRequestsWithoutBranch([own, fork, remoteOnly], "acme/widgets", [
        branch("feat/x"),
      ]).map(({ number }) => number),
    ).toEqual([2, 3]);
  });
});

describe("parseOpenPullRequests", () => {
  it("reads the nodes, a deleted fork and author as null", () => {
    expect(
      parseOpenPullRequests({
        data: {
          repository: {
            pullRequests: {
              totalCount: 120,
              nodes: [
                {
                  number: 4,
                  title: "t",
                  isDraft: true,
                  updatedAt: "2026-11-08T10:00:00Z",
                  headRefName: "b",
                  headRepository: null,
                  author: null,
                },
                null,
              ],
            },
          },
        },
        errors: [],
      }),
    ).toEqual({
      totalCount: 120,
      pullRequests: [
        {
          number: 4,
          title: "t",
          isDraft: true,
          headRefName: "b",
          headOwnerRepo: null,
          author: null,
          updatedAt: "2026-11-08T10:00:00Z",
        },
      ],
    });
  });

  it("raises GitHub's errors when the repository did not resolve", () => {
    expect(() =>
      parseOpenPullRequests({ data: null, errors: ["Bad credentials"] }),
    ).toThrow("Bad credentials");
  });
});

describe("parseBranchPullRequests", () => {
  const node = {
    number: 5,
    title: "feat: x",
    state: "MERGED" as const,
    isDraft: false,
    updatedAt: "2026-11-08T10:00:00Z",
    mergedAt: "2026-11-08T10:00:00Z",
    closedAt: "2026-11-08T10:00:00Z",
    baseRefName: "main",
    headRefOid: "abc",
    headRepository: { nameWithOwner: "Acme/Widgets" },
    author: null,
    commits: { nodes: [{ commit: { oid: "def" } }, null] },
  };

  it("keeps the repository's own heads, with their commits and a deleted author as null", () => {
    expect(
      parseBranchPullRequests(
        {
          data: {
            repository: {
              pullRequests: {
                nodes: [
                  node,
                  {
                    ...node,
                    number: 6,
                    headRepository: { nameWithOwner: "fork/widgets" },
                  },
                  { ...node, number: 7, headRepository: null },
                  null,
                ],
              },
            },
          },
          errors: [],
        },
        "acme/widgets",
      ),
    ).toEqual([
      {
        number: 5,
        title: "feat: x",
        state: "MERGED",
        isDraft: false,
        sha: "abc",
        baseRefName: "main",
        author: null,
        updatedAt: "2026-11-08T10:00:00Z",
        mergedAt: "2026-11-08T10:00:00Z",
        closedAt: "2026-11-08T10:00:00Z",
        commitOids: ["def"],
      },
    ]);
  });

  it("raises GitHub's errors when the repository did not resolve", () => {
    expect(() =>
      parseBranchPullRequests(
        { data: null, errors: ["Bad credentials"] },
        "acme/widgets",
      ),
    ).toThrow("Bad credentials");
  });
});
