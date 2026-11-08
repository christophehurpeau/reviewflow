import { describe, expect, it } from "vitest";
import {
  createReviewflowClient,
  maxExtraPagesPerBucket,
  readPrDetail,
  reviewflowErrorCode,
} from "./client.ts";

interface Call {
  url: string;
  method: string;
  authorization: string | null;
  body: unknown;
}

/** Answers by path; records every call, so a test can count requests. */
const fakeFetch = (
  answer: (path: string, body: unknown) => Response,
): { fetch: typeof globalThis.fetch; calls: Call[] } => {
  const calls: Call[] = [];
  // the client always passes a string url
  const fetch = ((input: string, init?: RequestInit) => {
    const body: unknown =
      typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    calls.push({
      url: input,
      method: init?.method ?? "GET",
      authorization: new Headers(init?.headers).get("authorization"),
      body,
    });
    return Promise.resolve(
      answer(input.replace("https://rf.example/api", ""), body),
    );
  }) as typeof globalThis.fetch;
  return { fetch, calls };
};

const json = (
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response =>
  Response.json(body, {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

/** a PrDetail as reviewflow 6.15 returns it, trimmed to what the client reads */
const prDetail = (overrides: Record<string, unknown> = {}): unknown => ({
  _id: "pr-1",
  ownerRepo: "acme/widgets",
  number: 8655,
  title: "chore: hourly triage",
  url: "https://github.com/acme/widgets/pull/8655",
  headRef: "chore/claude/hourly-monitoring-triage-GEN-8098",
  baseRef: "main",
  headSha: "abc",
  baseSha: "def",
  state: "open",
  reviewState: "approved",
  creator: { id: 1, login: "christophehurpeau" },
  checks: { conclusion: "passed", passed: 11, failed: 0, pending: 0 },
  unresolvedThreads: null,
  mergeable: "mergeable",
  flowDates: { closedAt: null },
  myBuckets: ["ready-to-merge"],
  updatedAt: "2026-10-16T09:00:00.000Z",
  ...overrides,
});

const client = (fetch: typeof globalThis.fetch) =>
  createReviewflowClient({ url: "https://rf.example", token: "rfp_x", fetch });

describe("readPrDetail", () => {
  it("reads the fields the client keeps", () => {
    expect(readPrDetail(prDetail())).toEqual({
      id: "pr-1",
      ownerRepo: "acme/widgets",
      number: 8655,
      title: "chore: hourly triage",
      url: "https://github.com/acme/widgets/pull/8655",
      headRef: "chore/claude/hourly-monitoring-triage-GEN-8098",
      baseRef: "main",
      headSha: "abc",
      baseSha: "def",
      state: "open",
      reviewState: "approved",
      author: "christophehurpeau",
      checks: {
        conclusion: "passed",
        passed: 11,
        failed: 0,
        pending: 0,
        running: 0,
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
      unresolvedThreads: null,
      mergeable: "mergeable",
      closedAt: null,
      commentActivityAt: null,
      reviewActivityAt: null,
      reviewCommentActivityAt: null,
      bodyEditedAt: null,
      updatedAt: "2026-10-16T09:00:00.000Z",
    });
  });

  it("reads the label names and the activity dates, absent from an older reviewflow", () => {
    expect(
      readPrDetail(
        prDetail({
          labels: [
            { id: 1, name: "bug" },
            { id: 2 },
            { id: 3, name: ":rocket: ship" },
          ],
          flowDates: {
            lastReviewCommentActivityAt: "2026-10-18T09:00:00.000Z",
            lastBodyEditedAt: "2026-10-18T10:00:00.000Z",
          },
        }),
      ),
    ).toMatchObject({
      labels: ["bug", ":rocket: ship"],
      reviewCommentActivityAt: "2026-10-18T09:00:00.000Z",
      bodyEditedAt: "2026-10-18T10:00:00.000Z",
    });
  });

  it("reads reviewflow's status line", () => {
    expect(
      readPrDetail(
        prDetail({
          checks: {
            conclusion: "in-progress",
            runningCount: 2,
            failedNames: ["build", "e2e"],
            checkRuns: null,
            statuses: null,
            passed: 3,
            failed: 2,
            pending: 2,
          },
          lintFailed: true,
          approvedBy: [{ id: 2, login: "alice" }],
          changesRequestedBy: [{ id: 3, login: "bob" }],
          requestedReviewers: [{ id: 4, login: "carol" }],
          reRequestedReviewers: [
            { id: 3, login: "bob" },
            { id: 4, login: "carol" },
          ],
          requestedTeams: ["frontend"],
          changes: { changedFiles: 3, additions: 120, deletions: 4 },
        }),
      ),
    ).toMatchObject({
      checks: {
        conclusion: "inProgress",
        running: 2,
        failedNames: ["build", "e2e"],
        checkRuns: null,
        statuses: null,
      },
      lintFailed: true,
      approvedBy: ["alice"],
      changesRequestedBy: ["bob"],
      requestedReviewers: ["carol"],
      reRequestedReviewers: ["bob", "carol"],
      requestedTeams: ["frontend"],
      changes: { changedFiles: 3, additions: 120, deletions: 4 },
    });
  });

  it("reads the people, the resolved links and the flow dates", () => {
    expect(
      readPrDetail(
        prDetail({
          assignees: [{ id: 2, login: "alice", avatarUrl: "https://a" }],
          statusLinks: [
            {
              name: "notion",
              label: "GEN-1",
              url: "https://n/1",
              type: "success",
            },
            { name: "jira", label: "J-2", url: "https://j/2", type: "failure" },
          ],
          flowDates: {
            openedAt: "2026-10-15T09:00:00.000Z",
            approvedAt: "2026-10-16T09:00:00.000Z",
            closedAt: null,
            commentActivityAt: null,
            reviewActivityAt: null,
          },
        }),
      ),
    ).toMatchObject({
      assignees: ["alice"],
      statusLinks: [{ name: "notion", label: "GEN-1", url: "https://n/1" }],
      openedAt: "2026-10-15T09:00:00.000Z",
      approvedAt: "2026-10-16T09:00:00.000Z",
    });
  });

  it("reads a conclusion it does not know as unknown", () => {
    expect(
      readPrDetail(prDetail({ checks: { conclusion: "skipped" } })).checks,
    ).toMatchObject({ conclusion: "unknown", running: 0, failedNames: [] });
  });

  it("reads a server that predates baseRef as no base", () => {
    expect(readPrDetail(prDetail({ baseRef: undefined }))).toMatchObject({
      baseRef: null,
    });
  });

  it("reads a state or review state it does not know as unknown", () => {
    expect(
      readPrDetail(prDetail({ state: "queued", reviewState: "maybe" })),
    ).toMatchObject({ state: null, reviewState: null });
  });

  it("refuses a pull request without its identity", () => {
    expect(() => readPrDetail({ number: 1 })).toThrow(/cannot read/);
  });
});

describe("createReviewflowClient", () => {
  it("sends the token as a bearer", async () => {
    const { fetch, calls } = fakeFetch(() =>
      json({
        user: { id: 1, login: "christophehurpeau" },
        accounts: [
          { id: 1, login: "christophehurpeau", type: "User", teams: [] },
          { id: 2, login: "acme", type: "Organization", teams: [] },
        ],
      }),
    );

    await expect(client(fetch).me()).resolves.toEqual({
      login: "christophehurpeau",
      accounts: [
        { login: "christophehurpeau", type: "User" },
        { login: "acme", type: "Organization" },
      ],
    });
    expect(calls[0]).toMatchObject({
      url: "https://rf.example/api/me/v1",
      authorization: "Bearer rfp_x",
    });
  });

  it("splits a lookup past 200 targets and keeps the order", async () => {
    const { fetch, calls } = fakeFetch((_path, body) => {
      const { targets } = body as { targets: { headRef: string }[] };
      return json({
        results: targets.map(({ headRef }) =>
          headRef === "b-250"
            ? { found: true, pr: prDetail({ headRef }) }
            : { found: false, reason: "noPr" },
        ),
      });
    });
    const targets = Array.from({ length: 250 }, (_, index) => ({
      ownerRepo: "o/r",
      headRef: `b-${String(index + 1)}`,
    }));

    const results = await client(fetch).lookup(targets);

    expect(calls).toHaveLength(2);
    expect(results).toHaveLength(250);
    expect(results[249]).toMatchObject({ found: true });
    expect(results[0]).toEqual({ found: false, reason: "noPr" });
  });

  it("reads a lookup reason it does not know as notTracked, never noPr", async () => {
    const { fetch } = fakeFetch(() =>
      json({ results: [{ found: false, reason: "archived" }] }),
    );

    await expect(
      client(fetch).lookup([{ ownerRepo: "o/r", headRef: "b" }]),
    ).resolves.toEqual([{ found: false, reason: "notTracked" }]);
  });

  it("follows a bucket's pages, dropping a row a page repeats", async () => {
    const { fetch, calls } = fakeFetch((path) => {
      if (path === "/board/v1?account=acme") {
        return json({
          groups: [
            {
              key: "requesting-attention",
              title: "PRs requesting your attention",
              buckets: [
                {
                  key: "requested-reviews",
                  title: "Requested reviews",
                  total: 3,
                  prs: [prDetail({ _id: "a" }), prDetail({ _id: "b" })],
                  nextPage: "page-2",
                },
              ],
            },
          ],
        });
      }
      expect(path).toBe(
        "/board-bucket/v1?bucket=requested-reviews&account=acme&page=page-2",
      );
      return json({
        key: "requested-reviews",
        title: "Requested reviews",
        total: 3,
        prs: [prDetail({ _id: "b" }), prDetail({ _id: "c" })],
        nextPage: null,
      });
    });

    const [group] = await client(fetch).board("acme");

    expect(calls).toHaveLength(2);
    expect(group?.buckets[0]?.prs.map(({ id }) => id)).toEqual(["a", "b", "c"]);
    expect(group?.buckets[0]?.total).toBe(3);
  });

  it("stops after the page cap rather than reading a bucket forever", async () => {
    const { fetch, calls } = fakeFetch((path) =>
      path.startsWith("/board/v1")
        ? json({
            groups: [
              {
                key: "g",
                title: "g",
                buckets: [
                  { key: "k", title: "k", total: 9999, prs: [], nextPage: "p" },
                ],
              },
            ],
          })
        : json({ key: "k", title: "k", total: 9999, prs: [], nextPage: "p" }),
    );

    await client(fetch).board("o");

    expect(calls).toHaveLength(1 + maxExtraPagesPerBucket);
  });

  it("reports the api's error envelope and Retry-After", async () => {
    const { fetch } = fakeFetch(() =>
      json(
        { error: { code: "rateLimited", message: "Too many requests" } },
        429,
        { "retry-after": "3" },
      ),
    );

    await expect(client(fetch).me()).rejects.toMatchObject({
      code: reviewflowErrorCode,
      status: 429,
      message:
        "reviewflow answered 429 rateLimited: Too many requests (retry after 3s)",
    });
  });

  it("reads one pull request, and none where reviewflow cannot answer for it", async () => {
    const { fetch, calls } = fakeFetch((path) => {
      if (path === "/pr/v1/acme/app/1") return json(prDetail({ number: 1 }));
      if (path === "/pr/v1/other/app/1") {
        return json({ error: { code: "forbidden", message: "" } }, 403);
      }
      if (path === "/pr/v1/acme/app/2") {
        return json({ error: { code: "notFound", message: "" } }, 404);
      }
      return json({ error: { code: "rateLimited", message: "" } }, 429);
    });

    await expect(client(fetch).pr("acme/app", 1)).resolves.toMatchObject({
      number: 1,
      baseRef: "main",
    });
    await expect(client(fetch).pr("other/app", 1)).resolves.toBeNull();
    await expect(client(fetch).pr("acme/app", 2)).resolves.toBeNull();
    await expect(client(fetch).pr("acme/app", 3)).rejects.toMatchObject({
      status: 429,
    });
    expect(calls[0]?.url).toBe("https://rf.example/api/pr/v1/acme/app/1");
  });

  it("says which server could not be reached", async () => {
    const fetch = (() =>
      Promise.reject(new TypeError("fetch failed"))) as typeof globalThis.fetch;

    await expect(client(fetch).board("o")).rejects.toThrow(
      "reviewflow could not be reached at https://rf.example: fetch failed",
    );
  });
});
