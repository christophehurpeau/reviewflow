import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyPullRequestEdit,
  editPullRequest,
  parsePullRequestEdit,
} from "./editPullRequest.ts";
import type { GitHubTransport } from "./transport.ts";

const ghGraphql = vi.hoisted(() => vi.fn());
const ghRest = vi.hoisted(() => vi.fn());

const transport: GitHubTransport = {
  graphql: ghGraphql,
  rest: ghRest,
  text: vi.fn(),
};

const ref = { ownerRepo: "acme/app", number: 12 };

describe("parsePullRequestEdit", () => {
  it("trims a title and refuses an empty one", () => {
    expect(parsePullRequestEdit({ kind: "title", title: "  New  " })).toEqual({
      kind: "title",
      title: "New",
    });
    expect(parsePullRequestEdit({ kind: "title", title: " " })).toBe(
      "a title cannot be empty",
    );
  });

  it("refuses an unknown kind and a malformed selection", () => {
    expect(parsePullRequestEdit({ kind: "nope" })).toBe("unknown edit kind");
    expect(parsePullRequestEdit({ kind: "labels", add: "bug" })).toMatch(
      /labels take/,
    );
    expect(parsePullRequestEdit(null)).toBe("edit is required");
  });
});

const sha = "a".repeat(40);

const draftComment = {
  path: "src/a.ts",
  side: "RIGHT",
  line: 12,
  startLine: null,
  startSide: null,
  body: "why?",
};

describe("parsePullRequestEdit, the review edits", () => {
  it("refuses a merge without a known method or a full head sha", () => {
    expect(
      parsePullRequestEdit({
        kind: "merge",
        method: "ff",
        expectedHeadSha: sha,
      }),
    ).toMatch(/merge method/);
    expect(
      parsePullRequestEdit({
        kind: "merge",
        method: "squash",
        expectedHeadSha: "abc",
      }),
    ).toMatch(/head sha/);
    expect(
      parsePullRequestEdit({
        kind: "merge",
        method: "squash",
        expectedHeadSha: sha,
      }),
    ).toEqual({ kind: "merge", method: "squash", expectedHeadSha: sha });
  });

  it("takes a commit message for a merge commit or a squash, never a rebase", () => {
    const merge = (method: string, commitMessage: unknown) =>
      parsePullRequestEdit({
        kind: "merge",
        method,
        expectedHeadSha: sha,
        commitMessage,
      });
    expect(merge("squash", { title: "Add it (#12)", body: "" })).toEqual({
      kind: "merge",
      method: "squash",
      expectedHeadSha: sha,
      commitMessage: { title: "Add it (#12)", body: "" },
    });
    expect(merge("rebase", { title: "Add it", body: "" })).toMatch(/rebase/);
    expect(merge("merge", { title: " ", body: "" })).toMatch(/title/);
    expect(merge("merge", { title: "Add it" })).toMatch(/body/);
    expect(merge("merge", "Add it")).toMatch(/object/);
  });

  it("refuses empty comments and replies, and an unknown edit target", () => {
    expect(parsePullRequestEdit({ kind: "comment", body: " " })).toMatch(
      /empty/,
    );
    expect(
      parsePullRequestEdit({ kind: "reply", inReplyTo: 0, body: "x" }),
    ).toMatch(/databaseId/);
    expect(
      parsePullRequestEdit({
        kind: "editComment",
        target: "gist",
        databaseId: 1,
        body: "x",
      }),
    ).toMatch(/target/);
    expect(parsePullRequestEdit({ kind: "state", state: "merged" })).toMatch(
      /state/,
    );
  });

  it("keeps an empty description but not an empty body elsewhere", () => {
    expect(parsePullRequestEdit({ kind: "body", body: "" })).toEqual({
      kind: "body",
      body: "",
    });
  });

  it("requires both ends of a range, ordered", () => {
    const edit = (comment: object) =>
      parsePullRequestEdit({
        kind: "inlineComment",
        commitId: sha,
        comment: { ...draftComment, ...comment },
      });

    expect(edit({ startLine: 10 })).toMatch(/startSide/);
    expect(edit({ startLine: 13, startSide: "RIGHT" })).toMatch(
      /cannot follow/,
    );
    expect(edit({ startSide: "RIGHT" })).toMatch(/needs a startLine/);
    expect(edit({ side: "TOP" })).toMatch(/LEFT or RIGHT/);
    expect(edit({ startLine: 10, startSide: "LEFT" })).toMatchObject({
      comment: { startLine: 10, startSide: "LEFT" },
    });
  });

  it("asks a body for requested changes and a body or a comment for a comment review", () => {
    const review = (event: string, body: string, comments: object[] = []) =>
      parsePullRequestEdit({
        kind: "review",
        event,
        body,
        commitId: sha,
        comments,
      });

    expect(review("requestChanges", "")).toMatch(/needs a body/);
    expect(review("comment", "")).toMatch(/body or a comment/);
    expect(review("comment", "", [draftComment])).toMatchObject({
      kind: "review",
    });
    expect(review("approve", "")).toMatchObject({ event: "approve" });
    expect(review("merge", "x")).toMatch(/review event/);
    expect(review("approve", "ok", [{ ...draftComment, body: "" }])).toMatch(
      /empty/,
    );
  });

  it("reads thread resolution and viewed marks", () => {
    expect(
      parsePullRequestEdit({
        kind: "resolveThread",
        threadId: "PRRT_1",
        resolved: true,
      }),
    ).toEqual({ kind: "resolveThread", threadId: "PRRT_1", resolved: true });
    expect(
      parsePullRequestEdit({ kind: "viewed", path: "a.ts", viewed: "yes" }),
    ).toMatch(/boolean/);
  });

  it("reads a reaction and refuses a content GitHub does not have", () => {
    expect(
      parsePullRequestEdit({
        kind: "reaction",
        subjectId: "IC_1",
        content: "hooray",
        reacted: true,
      }),
    ).toEqual({
      kind: "reaction",
      subjectId: "IC_1",
      content: "hooray",
      reacted: true,
    });
    expect(
      parsePullRequestEdit({
        kind: "reaction",
        subjectId: "IC_1",
        content: "HOORAY",
        reacted: true,
      }),
    ).toMatch(/unknown reaction/);
    expect(
      parsePullRequestEdit({
        kind: "reaction",
        content: "eyes",
        reacted: true,
      }),
    ).toMatch(/id/);
  });
});

describe("editPullRequest", () => {
  beforeEach(() => {
    ghGraphql.mockReset();
    ghRest.mockReset();
    ghRest.mockResolvedValue(null);
  });

  describe("startReview", () => {
    const edit = { kind: "startReview" } as const;

    it("is an edit that takes nothing", () => {
      expect(parsePullRequestEdit(edit)).toEqual(edit);
    });

    it("comments, then asks for the viewer's own review again", async () => {
      ghGraphql.mockResolvedValue({
        data: { viewer: { login: "ada" } },
        errors: [],
      });

      await expect(editPullRequest(transport, { ...ref, edit })).resolves.toBe(
        null,
      );

      expect(ghRest.mock.calls).toEqual([
        [
          {
            method: "POST",
            path: "repos/acme/app/pulls/12/reviews",
            body: { event: "COMMENT", body: "I started the review" },
          },
        ],
        [
          {
            method: "POST",
            path: "repos/acme/app/pulls/12/requested_reviewers",
            body: { reviewers: ["ada"] },
          },
        ],
      ]);
    });

    it("fails when the review is refused, asking nothing more", async () => {
      ghRest.mockRejectedValue(new Error("refused"));

      await expect(
        editPullRequest(transport, { ...ref, edit }),
      ).rejects.toThrow("refused");

      expect(ghGraphql).not.toHaveBeenCalled();
    });

    it("succeeds and logs when asking again is refused", async () => {
      const logger = { warn: vi.fn(), error: vi.fn() };
      ghGraphql.mockResolvedValue({
        data: { viewer: { login: "ada" } },
        errors: [],
      });
      ghRest
        .mockResolvedValueOnce(null)
        .mockRejectedValueOnce(new Error("no push access"));

      await expect(
        editPullRequest(transport, { ...ref, edit }, { logger }),
      ).resolves.toBe(null);

      expect(logger.warn).toHaveBeenCalledOnce();
    });
  });

  it("adds labels in one request and removes each by its encoded name", async () => {
    await editPullRequest(transport, {
      ...ref,
      edit: { kind: "labels", add: ["bug", "ui"], remove: ["needs review"] },
    });

    expect(ghRest.mock.calls).toEqual([
      [
        {
          method: "POST",
          path: "repos/acme/app/issues/12/labels",
          body: { labels: ["bug", "ui"] },
        },
      ],
      [
        {
          method: "DELETE",
          path: "repos/acme/app/issues/12/labels/needs%20review",
        },
      ],
    ]);
  });

  it("requests and removes people and teams, each direction in one request", async () => {
    await editPullRequest(transport, {
      ...ref,
      edit: {
        kind: "reviewers",
        add: ["carol"],
        remove: [],
        addTeams: ["backend"],
        removeTeams: ["frontend"],
      },
    });

    expect(ghRest.mock.calls).toEqual([
      [
        {
          method: "POST",
          path: "repos/acme/app/pulls/12/requested_reviewers",
          body: { reviewers: ["carol"], team_reviewers: ["backend"] },
        },
      ],
      [
        {
          method: "DELETE",
          path: "repos/acme/app/pulls/12/requested_reviewers",
          body: { reviewers: [], team_reviewers: ["frontend"] },
        },
      ],
    ]);
  });

  it("asks nothing for an empty selection change", async () => {
    await editPullRequest(transport, {
      ...ref,
      edit: {
        kind: "reviewers",
        add: [],
        remove: [],
        addTeams: [],
        removeTeams: [],
      },
    });

    expect(ghRest).not.toHaveBeenCalled();
  });

  it("marks ready for review through GraphQL, by node id", async () => {
    ghGraphql
      .mockResolvedValueOnce({
        data: { repository: { pullRequest: { id: "PR_node" } } },
        errors: [],
      })
      .mockResolvedValueOnce({ data: {}, errors: [] });

    await editPullRequest(transport, {
      ...ref,
      edit: { kind: "draft", draft: false },
    });

    expect(ghGraphql).toHaveBeenCalledTimes(2);
    expect(ghGraphql.mock.calls[1]?.[0]).toContain(
      "markPullRequestReadyForReview",
    );
    expect(ghGraphql.mock.calls[1]?.[1]).toEqual({ id: "PR_node" });
  });

  it("raises what GitHub refused on the draft change", async () => {
    ghGraphql
      .mockResolvedValueOnce({
        data: { repository: { pullRequest: { id: "PR_node" } } },
        errors: [],
      })
      .mockResolvedValueOnce({
        data: null,
        errors: ["Draft pull requests are not supported in this repository."],
      });

    await expect(
      editPullRequest(transport, {
        ...ref,
        edit: { kind: "draft", draft: true },
      }),
    ).rejects.toThrow("Draft pull requests are not supported");
  });

  const sent = async (edit: Parameters<typeof editPullRequest>[1]["edit"]) => {
    ghRest.mockClear();
    await editPullRequest(transport, { ...ref, edit });
    return ghRest.mock.calls.map(([call]) => call);
  };

  it("sends the description, the state, a merge and a branch update", async () => {
    expect(await sent({ kind: "body", body: "New text" })).toEqual([
      {
        method: "PATCH",
        path: "repos/acme/app/pulls/12",
        body: { body: "New text" },
      },
    ]);
    expect(await sent({ kind: "state", state: "closed" })).toEqual([
      {
        method: "PATCH",
        path: "repos/acme/app/pulls/12",
        body: { state: "closed" },
      },
    ]);
    expect(
      await sent({ kind: "merge", method: "squash", expectedHeadSha: sha }),
    ).toEqual([
      {
        method: "PUT",
        path: "repos/acme/app/pulls/12/merge",
        body: { merge_method: "squash", sha },
      },
    ]);
    expect(
      await sent({
        kind: "merge",
        method: "merge",
        expectedHeadSha: sha,
        commitMessage: { title: "Merge #12", body: "Details" },
      }),
    ).toEqual([
      {
        method: "PUT",
        path: "repos/acme/app/pulls/12/merge",
        body: {
          merge_method: "merge",
          sha,
          commit_title: "Merge #12",
          commit_message: "Details",
        },
      },
    ]);
    expect(await sent({ kind: "updateBranch", expectedHeadSha: sha })).toEqual([
      {
        method: "PUT",
        path: "repos/acme/app/pulls/12/update-branch",
        body: { expected_head_sha: sha },
      },
    ]);
  });

  it("adds and removes assignees, skipping an empty side", async () => {
    expect(
      await sent({ kind: "assignees", add: ["carol"], remove: [] }),
    ).toEqual([
      {
        method: "POST",
        path: "repos/acme/app/issues/12/assignees",
        body: { assignees: ["carol"] },
      },
    ]);
    expect(
      await sent({ kind: "assignees", add: [], remove: ["dave"] }),
    ).toEqual([
      {
        method: "DELETE",
        path: "repos/acme/app/issues/12/assignees",
        body: { assignees: ["dave"] },
      },
    ]);
  });

  it("comments, replies and edits each kind of comment at its own endpoint", async () => {
    expect(await sent({ kind: "comment", body: "hi" })).toEqual([
      {
        method: "POST",
        path: "repos/acme/app/issues/12/comments",
        body: { body: "hi" },
      },
    ]);
    expect(await sent({ kind: "reply", inReplyTo: 99, body: "re" })).toEqual([
      {
        method: "POST",
        path: "repos/acme/app/pulls/12/comments/99/replies",
        body: { body: "re" },
      },
    ]);
    const edited = (target: "issueComment" | "review" | "reviewComment") =>
      sent({ kind: "editComment", target, databaseId: 7, body: "b" });
    expect(await edited("issueComment")).toEqual([
      {
        method: "PATCH",
        path: "repos/acme/app/issues/comments/7",
        body: { body: "b" },
      },
    ]);
    expect(await edited("reviewComment")).toEqual([
      {
        method: "PATCH",
        path: "repos/acme/app/pulls/comments/7",
        body: { body: "b" },
      },
    ]);
    expect(await edited("review")).toEqual([
      {
        method: "PUT",
        path: "repos/acme/app/pulls/12/reviews/7",
        body: { body: "b" },
      },
    ]);
  });

  const headIs = (headRefOid: string) => {
    ghGraphql.mockResolvedValue({
      data: { repository: { pullRequest: { headRefOid } } },
      errors: [],
    });
  };

  it("submits a review with its comments, omitting an empty body and absent ranges", async () => {
    headIs(sha);
    const [call] = await sent({
      kind: "review",
      event: "requestChanges",
      body: "",
      commitId: sha,
      comments: [
        {
          path: "a.ts",
          side: "RIGHT",
          line: 5,
          startLine: null,
          startSide: null,
          body: "one",
        },
        {
          path: "b.ts",
          side: "LEFT",
          line: 9,
          startLine: 7,
          startSide: "LEFT",
          body: "two",
        },
      ],
    });

    expect(call).toEqual({
      method: "POST",
      path: "repos/acme/app/pulls/12/reviews",
      body: {
        commit_id: sha,
        event: "REQUEST_CHANGES",
        comments: [
          { path: "a.ts", side: "RIGHT", line: 5, body: "one" },
          {
            path: "b.ts",
            side: "LEFT",
            line: 9,
            body: "two",
            start_line: 7,
            start_side: "LEFT",
          },
        ],
      },
    });
  });

  it("posts a lone inline comment and a verdict with a body", async () => {
    const [inline] = await sent({
      kind: "inlineComment",
      commitId: sha,
      comment: {
        path: "a.ts",
        side: "RIGHT",
        line: 5,
        startLine: null,
        startSide: null,
        body: "x",
      },
    });
    expect(inline).toEqual({
      method: "POST",
      path: "repos/acme/app/pulls/12/comments",
      body: { commit_id: sha, path: "a.ts", body: "x", line: 5, side: "RIGHT" },
    });

    headIs(sha);
    const [approval] = await sent({
      kind: "review",
      event: "approve",
      body: "lgtm",
      commitId: sha,
      comments: [],
    });
    expect(approval).toMatchObject({
      body: { body: "lgtm", event: "APPROVE", comments: [] },
    });
  });

  it("refuses a verdict on a head the pull request has left, not a comment review", async () => {
    headIs("b".repeat(40));
    const review = (event: "approve" | "comment" | "requestChanges") =>
      sent({ kind: "review", event, body: "x", commitId: sha, comments: [] });

    await expect(review("approve")).rejects.toThrow(
      /moved on to bbbbbbb since aaaaaaa/,
    );
    await expect(review("requestChanges")).rejects.toThrow(/moved on/);
    expect(ghRest).not.toHaveBeenCalled();

    expect(await review("comment")).toMatchObject([
      { body: { event: "COMMENT" } },
    ]);
  });

  it("resolves a thread and marks a file viewed through GraphQL", async () => {
    ghGraphql.mockResolvedValue({ data: {}, errors: [] });
    await editPullRequest(transport, {
      ...ref,
      edit: { kind: "resolveThread", threadId: "PRRT_1", resolved: false },
    });
    expect(ghGraphql.mock.calls[0]?.[0]).toContain("unresolveReviewThread");
    expect(ghGraphql.mock.calls[0]?.[1]).toEqual({ threadId: "PRRT_1" });

    ghGraphql.mockReset();
    ghGraphql
      .mockResolvedValueOnce({
        data: { repository: { pullRequest: { id: "PR_node" } } },
        errors: [],
      })
      .mockResolvedValueOnce({ data: {}, errors: [] });
    await editPullRequest(transport, {
      ...ref,
      edit: { kind: "viewed", path: "a.ts", viewed: true },
    });
    expect(ghGraphql.mock.calls[1]?.[0]).toContain("markFileAsViewed");
    expect(ghGraphql.mock.calls[1]?.[1]).toEqual({
      id: "PR_node",
      path: "a.ts",
    });
  });

  it("adds and removes a reaction through GraphQL, in GitHub's enum", async () => {
    ghGraphql.mockResolvedValue({ data: {}, errors: [] });
    await editPullRequest(transport, {
      ...ref,
      edit: {
        kind: "reaction",
        subjectId: "IC_1",
        content: "thumbsUp",
        reacted: true,
      },
    });
    await editPullRequest(transport, {
      ...ref,
      edit: {
        kind: "reaction",
        subjectId: "IC_1",
        content: "thumbsUp",
        reacted: false,
      },
    });
    expect(ghGraphql.mock.calls[0]?.[0]).toContain("addReaction");
    expect(ghGraphql.mock.calls[1]?.[0]).toContain("removeReaction");
    expect(ghGraphql.mock.calls[1]?.[1]).toEqual({
      subjectId: "IC_1",
      content: "THUMBS_UP",
    });
  });

  it("raises what GitHub refused on a thread change", async () => {
    ghGraphql.mockResolvedValue({ data: null, errors: ["Forbidden"] });
    await expect(
      editPullRequest(transport, {
        ...ref,
        edit: { kind: "resolveThread", threadId: "PRRT_1", resolved: true },
      }),
    ).rejects.toThrow("Forbidden");
  });

  it("hands the logger the thrown error itself when the viewed mark cannot be applied", async () => {
    ghGraphql
      .mockResolvedValueOnce({
        data: { repository: { pullRequest: { id: "PR_node" } } },
        errors: [],
      })
      .mockResolvedValueOnce({ data: {}, errors: [] });
    const failure = new Error("store is closed");
    const logger = { warn: vi.fn(), error: vi.fn() };

    await applyPullRequestEdit(
      transport,
      { ...ref, edit: { kind: "viewed", path: "a.ts", viewed: true } },
      {
        logger,
        onFileViewed: () => {
          throw failure;
        },
      },
    );

    expect(logger.error).toHaveBeenCalledWith(
      "viewed mark not applied to the last read",
      { error: failure },
    );
    expect(logger.error.mock.calls[0]?.[1].error).toBe(failure);
  });
});
