/* oxlint-disable typescript/require-await, unicorn/no-await-expression-member, typescript/consistent-type-assertions, eslint/object-shorthand, eslint/func-names, eslint/no-loop-func, typescript/only-throw-error, eslint/no-bitwise, import/no-duplicates */
import { describe, expect, it } from "vitest";
import type { ReviewflowBoardSnapshot } from "./board.ts";
import {
  applyStreamEvent,
  assembleBoard,
  isPullRequestOnBoard,
  readAccountBoards,
  withAccountBoard,
} from "./board.ts";
import type { ReviewflowGroup, ReviewflowPrDetail } from "./client.ts";

const detail = (
  overrides: Partial<ReviewflowPrDetail> = {},
): ReviewflowPrDetail => ({
  id: "rf-12",
  ownerRepo: "owner/repo",
  number: 12,
  title: "a pull request",
  url: "https://github.com/owner/repo/pull/12",
  headRef: "feat/one",
  baseRef: "main",
  headSha: "abc",
  baseSha: "def",
  state: "open",
  reviewState: "requested",
  author: "me",
  checks: {
    conclusion: "inProgress",
    passed: 1,
    failed: 0,
    pending: 2,
    running: 1,
    failedNames: [],
    checkRuns: null,
    statuses: null,
  },
  lintFailed: false,
  approvedBy: [],
  changesRequestedBy: [],
  requestedReviewers: [],
  reRequestedReviewers: [],
  requestedTeams: [],
  assignees: [],
  labels: [],
  statusLinks: [],
  changes: null,
  openedAt: null,
  approvedAt: null,
  unresolvedThreads: 0,
  mergeable: "mergeable",
  closedAt: null,
  commentActivityAt: null,
  reviewActivityAt: null,
  reviewCommentActivityAt: null,
  bodyEditedAt: null,
  updatedAt: "2026-10-18T09:00:00.000Z",
  ...overrides,
});

const group = (
  key: string,
  buckets: { key: string; total: number; prs: ReviewflowPrDetail[] }[],
): ReviewflowGroup => ({
  key,
  title: key,
  buckets: buckets.map((bucket) => ({ ...bucket, title: bucket.key })),
});

const acme: ReviewflowGroup[] = [
  group("mine", [
    { key: "review", total: 120, prs: [detail({ id: "a", number: 1 })] },
    { key: "drafts", total: 1, prs: [detail({ id: "b", number: 2 })] },
  ]),
  group("others", [{ key: "watching", total: 3, prs: [] }]),
];
const beta: ReviewflowGroup[] = [
  group("mine", [
    {
      key: "review",
      total: 2,
      prs: [detail({ id: "c", ownerRepo: "beta/x", number: 3 })],
    },
  ]),
];

const snapshot = (): ReviewflowBoardSnapshot =>
  withAccountBoard(
    withAccountBoard({}, "acme", {
      groups: acme,
      fetchedAt: "2026-11-06T10:00:00Z",
    }),
    "beta",
    { groups: beta, fetchedAt: "2026-11-06T09:00:00Z" },
  );

describe("assembleBoard", () => {
  it("is null before any read", () => {
    expect(assembleBoard({}, "me")).toEqual({ board: null, viewer: "me" });
  });

  it("merges accounts bucket by bucket, adds totals, keeps order and the oldest read", () => {
    const { board, viewer } = assembleBoard(snapshot(), "me");
    expect(viewer).toBe("me");
    expect(board?.fetchedAt).toBe("2026-11-06T09:00:00Z");
    expect(board?.groups.map((g) => g.key)).toEqual(["mine", "others"]);
    const [mine] = board!.groups;
    expect(mine!.buckets.map((b) => [b.key, b.total])).toEqual([
      ["review", 122],
      ["drafts", 1],
    ]);
    expect(mine!.buckets[0]!.prs.map((pr) => pr.id)).toEqual(["a", "c"]);
  });

  it("only covers the accounts asked for", () => {
    const { board } = assembleBoard(snapshot(), null, ["beta"]);
    expect(board?.groups).toHaveLength(1);
    expect(board?.groups[0]?.buckets[0]?.total).toBe(2);
  });

  it("carries the row fields the screen needs", () => {
    const { board } = assembleBoard(snapshot(), null, ["beta"]);
    expect(board?.groups[0]?.buckets[0]?.prs[0]).toMatchObject({
      id: "c",
      checksFailed: 0,
      checksConclusion: "inProgress",
      reviewState: "requested",
    });
  });
});

describe("isPullRequestOnBoard", () => {
  const { board } = assembleBoard(snapshot(), null);

  it("finds a row by repository, ignoring case, and number", () => {
    expect(
      isPullRequestOnBoard(board, { ownerRepo: "Beta/X", number: 3 }),
    ).toBe(true);
  });

  it("is false for another number, another repository, or no board", () => {
    expect(
      isPullRequestOnBoard(board, { ownerRepo: "beta/x", number: 1 }),
    ).toBe(false);
    expect(
      isPullRequestOnBoard(board, { ownerRepo: "owner/other", number: 1 }),
    ).toBe(false);
    expect(isPullRequestOnBoard(null, { ownerRepo: "beta/x", number: 3 })).toBe(
      false,
    );
  });
});

describe("readAccountBoards", () => {
  it("lets an account fail alone", async () => {
    const read = await readAccountBoards(
      {
        board: async (account) => {
          if (account === "beta") throw new Error("forbidden");
          return acme;
        },
      },
      ["acme", "beta"],
    );
    expect(read.boards.map((b) => b.account)).toEqual(["acme"]);
    expect(read.errors).toEqual([{ account: "beta", message: "forbidden" }]);
  });
});

describe("applyStreamEvent", () => {
  it("replaces a row in place and flags the account for a read", () => {
    const before = snapshot();
    const pr = detail({ id: "a", number: 1, title: "renamed" });
    const applied = applyStreamEvent(before, { type: "pr", pr });
    expect(applied.changed).toBe(true);
    expect(applied.readAccounts).toEqual(["acme"]);
    expect(
      assembleBoard(applied.snapshot, null, ["acme"]).board?.groups[0]
        ?.buckets[0]?.prs[0]?.title,
    ).toBe("renamed");
    // the input is not mutated
    expect(before.acme!.groups[0]!.buckets[0]!.prs[0]!.title).toBe(
      "a pull request",
    );
  });

  it("flags the owner's account for a pull request not on the board yet, changing nothing", () => {
    const before = snapshot();
    const applied = applyStreamEvent(before, {
      type: "pr",
      pr: detail({ id: "new", ownerRepo: "Acme/repo", number: 9 }),
    });
    expect(applied.changed).toBe(false);
    expect(applied.snapshot).toBe(before);
    expect(applied.readAccounts).toEqual(["acme"]);
  });

  it("removes a row and lowers the total", () => {
    const applied = applyStreamEvent(snapshot(), {
      type: "prRemoved",
      id: "a",
    });
    const bucket = applied.snapshot.acme!.groups[0]!.buckets[0]!;
    expect(bucket.prs).toEqual([]);
    expect(bucket.total).toBe(119);
    expect(applied.readAccounts).toEqual(["acme"]);
  });

  it("ignores events that are not about a pull request", () => {
    const before = snapshot();
    expect(applyStreamEvent(before, { type: "ready" })).toEqual({
      snapshot: before,
      changed: false,
      readAccounts: [],
    });
  });
});
