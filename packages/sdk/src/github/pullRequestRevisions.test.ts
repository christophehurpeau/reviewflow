import { describe, expect, it } from "vitest";
import { parsePullRequestRevisions } from "./pullRequestRevisions.ts";

const edit = (
  editedAt: string,
  diff: string,
  overrides: Partial<{
    deletedAt: string;
    deletedBy: { login: string };
  }> = {},
) => ({
  editedAt,
  deletedAt: null,
  editor: { login: "alice", avatarUrl: "https://avatars/alice" },
  deletedBy: null,
  diff,
  ...overrides,
});

describe("parsePullRequestRevisions", () => {
  it("diffs each revision against the next older one, the original last", () => {
    const { revisions, revisionsTotal } = parsePullRequestRevisions({
      subjectId: "IC_1",
      errors: [],
      data: {
        node: {
          includesCreatedEdit: true,
          userContentEdits: {
            totalCount: 2,
            nodes: [
              edit("2026-10-02T00:00:00Z", "one\r\nthree\r\n"),
              edit("2026-10-01T00:00:00Z", "one\ntwo\n"),
            ],
          },
        },
      },
    });

    expect(revisionsTotal).toBe(2);
    expect(revisions).toEqual([
      {
        editedAt: "2026-10-02T00:00:00Z",
        editor: { login: "alice", avatarUrl: "https://avatars/alice" },
        original: false,
        body: "one\nthree\n",
        deletedBy: null,
        changes: [
          { kind: "context", text: "one" },
          { kind: "removed", text: "two" },
          { kind: "added", text: "three" },
        ],
      },
      {
        editedAt: "2026-10-01T00:00:00Z",
        editor: { login: "alice", avatarUrl: "https://avatars/alice" },
        original: true,
        body: "one\ntwo\n",
        deletedBy: null,
        changes: null,
      },
    ]);
  });

  it("skips a deleted revision when diffing, and keeps no text for it", () => {
    const { revisions } = parsePullRequestRevisions({
      subjectId: "IC_1",
      errors: [],
      data: {
        node: {
          includesCreatedEdit: true,
          userContentEdits: {
            totalCount: 3,
            nodes: [
              edit("2026-10-03T00:00:00Z", "c"),
              edit("2026-10-02T00:00:00Z", "secret", {
                deletedAt: "2026-10-04T00:00:00Z",
                deletedBy: { login: "alice" },
              }),
              edit("2026-10-01T00:00:00Z", "a"),
            ],
          },
        },
      },
    });

    expect(
      revisions.map(({ body, deletedBy }) => ({ body, deletedBy })),
    ).toEqual([
      { body: "c", deletedBy: null },
      { body: null, deletedBy: "alice" },
      { body: "a", deletedBy: null },
    ]);
    expect(revisions[0]?.changes).toEqual([
      { kind: "removed", text: "a" },
      { kind: "added", text: "c" },
    ]);
  });

  it("marks no revision original past the first page", () => {
    const { revisions } = parsePullRequestRevisions({
      subjectId: "IC_1",
      errors: [],
      data: {
        node: {
          includesCreatedEdit: true,
          userContentEdits: {
            totalCount: 80,
            nodes: [edit("2026-10-01T00:00:00Z", "a")],
          },
        },
      },
    });

    expect(revisions[0]).toMatchObject({ original: false, changes: null });
  });

  it("still marks the original when GitHub could not resolve an edit", () => {
    const { revisions } = parsePullRequestRevisions({
      subjectId: "IC_1",
      errors: [],
      data: {
        node: {
          includesCreatedEdit: true,
          userContentEdits: {
            totalCount: 3,
            nodes: [
              edit("2026-10-03T00:00:00Z", "c"),
              null,
              edit("2026-10-01T00:00:00Z", "a"),
            ],
          },
        },
      },
    });

    expect(revisions.map(({ original }) => original)).toEqual([false, true]);
  });

  it("raises with GitHub's reason when the id names no comment", () => {
    expect(() =>
      parsePullRequestRevisions({
        subjectId: "IC_x",
        errors: ["Could not resolve to a node with the global id of 'IC_x'"],
        data: { node: null },
      }),
    ).toThrow("no edit history for IC_x: Could not resolve");
  });
});
