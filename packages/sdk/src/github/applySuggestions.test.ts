import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApplySuggestionsEdit } from "./applySuggestions.ts";
import {
  applySuggestionsToText,
  coAuthorTrailers,
  planSuggestions,
} from "./applySuggestions.ts";
import { editPullRequest, parsePullRequestEdit } from "./editPullRequest.ts";
import type { GitHubTransport } from "./transport.ts";

const ghGraphql = vi.hoisted(() => vi.fn());
const ghRest = vi.hoisted(() => vi.fn());

const transport: GitHubTransport = {
  graphql: ghGraphql,
  rest: ghRest,
  text: vi.fn(),
};

const head = "a".repeat(40);

const edit: ApplySuggestionsEdit = {
  kind: "applySuggestions",
  expectedHeadSha: head,
  suggestions: [{ threadId: "T1", commentId: "C2" }],
  headline: "Apply suggestion from code review",
  body: "",
};

const thread = (overrides: Record<string, unknown> = {}) => ({
  id: "T1",
  path: "src/a.ts",
  line: 2,
  startLine: null,
  diffSide: "RIGHT",
  startDiffSide: null,
  isOutdated: false,
  isResolved: false,
  pullRequest: { id: "PR_1" },
  comments: { nodes: [{ id: "C1" }] },
  ...overrides,
});

const comment = (overrides: Record<string, unknown> = {}) => ({
  id: "C2",
  body: "Nicer:\r\n```suggestion\r\nconst b = 2;\r\n```",
  state: "SUBMITTED",
  replyTo: { id: "C1" },
  author: { login: "carol", databaseId: 7, name: "Carol" },
  ...overrides,
});

const answer = (
  overrides: {
    pullRequest?: Record<string, unknown>;
    threads?: unknown[];
    comments?: unknown[];
  } = {},
) => ({
  viewer: { login: "me" },
  repository: {
    pullRequest: {
      id: "PR_1",
      state: "OPEN",
      headRefOid: head,
      headRefName: "feat/x",
      viewerCanApplySuggestion: true,
      headRepository: { nameWithOwner: "fork/app" },
      ...overrides.pullRequest,
    },
  },
  threads: overrides.threads ?? [thread()],
  comments: overrides.comments ?? [comment()],
});

describe("planSuggestions", () => {
  it("reads the suggestion of a reply on its thread's lines", () => {
    expect(planSuggestions(answer() as never, edit)).toEqual({
      repositoryNameWithOwner: "fork/app",
      branchName: "feat/x",
      viewerLogin: "me",
      suggestions: [
        {
          threadId: "T1",
          resolved: false,
          path: "src/a.ts",
          startLine: null,
          line: 2,
          lines: ["const b = 2;"],
          author: { login: "carol", databaseId: 7, name: "Carol" },
        },
      ],
    });
  });

  it("refuses a head that moved, a comment of another thread, an outdated thread", () => {
    expect(() =>
      planSuggestions(
        answer({ pullRequest: { headRefOid: "b".repeat(40) } }) as never,
        edit,
      ),
    ).toThrow(/moved on to bbbbbbb since aaaaaaa/);
    expect(() =>
      planSuggestions(
        answer({ comments: [comment({ replyTo: { id: "C9" } })] }) as never,
        edit,
      ),
    ).toThrow(/not in that thread/);
    expect(() =>
      planSuggestions(
        answer({
          threads: [thread({ isOutdated: true, line: null })],
        }) as never,
        edit,
      ),
    ).toThrow(/src\/a.ts: Outdated/);
    expect(() =>
      planSuggestions(
        answer({ comments: [comment({ state: "PENDING" })] }) as never,
        edit,
      ),
    ).toThrow(/pending review/);
  });

  it("refuses two suggestions of the batch on one line", () => {
    const batch = {
      ...edit,
      suggestions: [
        { threadId: "T1", commentId: "C2" },
        { threadId: "T2", commentId: "C3" },
      ],
    };
    expect(() =>
      planSuggestions(
        answer({
          threads: [
            thread(),
            thread({
              id: "T2",
              startLine: 1,
              line: 3,
              comments: { nodes: [{ id: "C3" }] },
            }),
          ],
          comments: [comment(), comment({ id: "C3", replyTo: null })],
        }) as never,
        batch,
      ),
    ).toThrow(/two suggestions of the batch replace line 3/);
  });
});

describe("applySuggestionsToText", () => {
  it("replaces ranges bottom first, a deletion included", () => {
    expect(
      applySuggestionsToText("a\nb\nc\nd\n", [
        { startLine: null, line: 1, lines: ["A", "A2"] },
        { startLine: 3, line: 4, lines: [] },
      ]),
    ).toBe("A\nA2\nb\n");
  });

  it("keeps CRLF, and a last line without newline", () => {
    expect(
      applySuggestionsToText("a\r\nb", [
        { startLine: 1, line: 2, lines: ["x", "y"] },
      ]),
    ).toBe("x\r\ny");
  });

  it("refuses a line past the end", () => {
    expect(() =>
      applySuggestionsToText("a\n", [{ startLine: null, line: 2, lines: [] }]),
    ).toThrow(/past the end of the file, 1 lines long/);
  });
});

describe("coAuthorTrailers", () => {
  it("credits each suggester once, not the committer nor a bot", () => {
    expect(
      coAuthorTrailers(
        [
          { login: "carol", databaseId: 7, name: "Carol" },
          { login: "carol", databaseId: 7, name: "Carol" },
          { login: "dan", databaseId: 8, name: null },
          { login: "me", databaseId: 1, name: "Me" },
          { login: "bot" },
          null,
        ],
        "me",
      ),
    ).toEqual([
      "Co-authored-by: Carol <7+carol@users.noreply.github.com>",
      "Co-authored-by: dan <8+dan@users.noreply.github.com>",
    ]);
  });
});

describe("editPullRequest applySuggestions", () => {
  beforeEach(() => {
    ghGraphql.mockReset();
  });

  it("parses the edit off the wire", () => {
    expect(parsePullRequestEdit({ ...edit, headline: "  Apply  " })).toEqual({
      ...edit,
      headline: "Apply",
    });
    expect(parsePullRequestEdit({ ...edit, suggestions: [] })).toMatch(
      /non-empty/,
    );
    expect(
      parsePullRequestEdit({ ...edit, suggestions: [{ threadId: "T1" }] }),
    ).toMatch(/commentId/);
  });

  it("commits the rewritten file on the head branch, then resolves the thread", async () => {
    ghGraphql
      .mockResolvedValueOnce({ data: answer(), errors: [] })
      .mockResolvedValueOnce({
        data: {
          repository: {
            f0: { text: "a\nb\n", isBinary: false, isTruncated: false },
          },
        },
        errors: [],
      })
      .mockResolvedValue({ data: {}, errors: [] });

    expect(
      await editPullRequest(transport, {
        ownerRepo: "acme/app",
        number: 12,
        edit,
      }),
    ).toBe(null);

    expect(ghGraphql.mock.calls[1]?.[1]).toEqual({
      owner: "fork",
      name: "app",
      e0: `${head}:src/a.ts`,
    });
    expect(ghGraphql.mock.calls[2]?.[0]).toContain("createCommitOnBranch");
    expect(ghGraphql.mock.calls[2]?.[1]).toEqual({
      input: {
        branch: { repositoryNameWithOwner: "fork/app", branchName: "feat/x" },
        expectedHeadOid: head,
        message: {
          headline: "Apply suggestion from code review",
          body: "Co-authored-by: Carol <7+carol@users.noreply.github.com>",
        },
        fileChanges: {
          additions: [
            {
              path: "src/a.ts",
              contents: Buffer.from("a\nconst b = 2;\n").toString("base64"),
            },
          ],
        },
      },
    });
    expect(ghGraphql.mock.calls[3]?.[0]).toContain("resolveReviewThread");
    expect(ghGraphql.mock.calls[3]?.[1]).toEqual({ threadId: "T1" });
  });

  it("answers a thread left unresolved instead of failing the landed commit", async () => {
    ghGraphql
      .mockResolvedValueOnce({ data: answer(), errors: [] })
      .mockResolvedValueOnce({
        data: {
          repository: {
            f0: { text: "a\nb\n", isBinary: false, isTruncated: false },
          },
        },
        errors: [],
      })
      .mockResolvedValueOnce({ data: {}, errors: [] })
      .mockResolvedValueOnce({ data: null, errors: ["Forbidden"] });

    expect(
      await editPullRequest(transport, {
        ownerRepo: "acme/app",
        number: 12,
        edit,
      }),
    ).toMatch(/committed, but 1 thread stayed unresolved: .*Forbidden/);
  });

  it("commits nothing when GitHub's state refuses it", async () => {
    ghGraphql.mockResolvedValueOnce({
      data: answer({ pullRequest: { state: "MERGED" } }),
      errors: [],
    });
    await expect(
      editPullRequest(transport, { ownerRepo: "acme/app", number: 12, edit }),
    ).rejects.toThrow(/is merged/);
    expect(ghGraphql).toHaveBeenCalledTimes(1);
  });
});
