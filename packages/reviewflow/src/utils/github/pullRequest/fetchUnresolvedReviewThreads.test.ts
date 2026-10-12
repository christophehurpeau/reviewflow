import { describe, expect, test, vi } from "vitest";
import { fetchUnresolvedReviewThreads } from "./fetchUnresolvedReviewThreads.ts";

const node = (id: number | null, isResolved: boolean, login?: string) => ({
  isResolved,
  comments: {
    nodes: [
      {
        databaseId: id,
        url: `https://github.com/o/r/pull/1#discussion_r${id}`,
        path: "src/a.ts",
        author: login ? { login } : null,
      },
    ],
  },
});

const page = (nodes: ReturnType<typeof node>[], endCursor: string | null) => ({
  repository: {
    pullRequest: {
      reviewThreads: {
        pageInfo: { hasNextPage: endCursor !== null, endCursor },
        nodes,
      },
    },
  },
});

const pullRequest = { owner: "o", repo: "r", number: 1 };

describe("fetchUnresolvedReviewThreads", () => {
  test("keeps the unresolved threads, across pages", async () => {
    const graphql = vi
      .fn()
      .mockResolvedValueOnce(
        page([node(1, false, "alice"), node(2, true, "bob")], "cursor-1"),
      )
      .mockResolvedValueOnce(page([node(3, false)], null));

    const threads = await fetchUnresolvedReviewThreads(
      { graphql },
      pullRequest,
    );

    expect(threads).toEqual([
      {
        rootCommentId: 1,
        url: "https://github.com/o/r/pull/1#discussion_r1",
        path: "src/a.ts",
        authorLogin: "alice",
      },
      {
        rootCommentId: 3,
        url: "https://github.com/o/r/pull/1#discussion_r3",
        path: "src/a.ts",
        authorLogin: null,
      },
    ]);
    expect(graphql).toHaveBeenCalledTimes(2);
    expect(graphql.mock.calls[0]?.[1]).toMatchObject({
      number: 1,
      after: null,
    });
    expect(graphql.mock.calls[1]?.[1]).toMatchObject({ after: "cursor-1" });
  });

  test("skips a thread without a readable root comment", async () => {
    const graphql = vi.fn().mockResolvedValue(page([node(null, false)], null));

    expect(
      await fetchUnresolvedReviewThreads({ graphql }, pullRequest),
    ).toEqual([]);
  });

  test("throws when the pull request is not found", async () => {
    const graphql = vi
      .fn()
      .mockResolvedValue({ repository: { pullRequest: null } });

    await expect(
      fetchUnresolvedReviewThreads({ graphql }, pullRequest),
    ).rejects.toThrow("not found");
  });
});
