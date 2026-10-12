import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { AppContext } from "../../../context/AppContext.ts";
import type { RepoContext } from "../../../context/repoContext.ts";
import type * as MergeConflictSlackMessage from "../actions/mergeConflictSlackMessage.ts";
import type * as FetchPr from "./fetchPr.ts";
import type * as RefreshMergeable from "./refreshMergeable.ts";

let markMergeConflictAsDone: typeof MergeConflictSlackMessage.markMergeConflictAsDone;
let syncMergeConflictSlackMessage: typeof MergeConflictSlackMessage.syncMergeConflictSlackMessage;
let fetchPr: typeof FetchPr.fetchPr;
let scheduleMergeableRefresh: typeof RefreshMergeable.scheduleMergeableRefresh;

// the setup file already imported the whole app: `vi.mock` would come too late
beforeAll(async () => {
  vi.resetModules();
  vi.doMock("../actions/mergeConflictSlackMessage.ts", () => ({
    markMergeConflictAsDone: vi.fn(() => Promise.resolve()),
    syncMergeConflictSlackMessage: vi.fn(() => Promise.resolve()),
  }));
  vi.doMock("./fetchPr.ts", () => ({ fetchPr: vi.fn() }));

  ({ markMergeConflictAsDone, syncMergeConflictSlackMessage } =
    await import("../actions/mergeConflictSlackMessage.ts"));
  ({ fetchPr } = await import("./fetchPr.ts"));
  ({ scheduleMergeableRefresh } = await import("./refreshMergeable.ts"));
});

type GraphqlMergeable = "CONFLICTING" | "MERGEABLE" | "UNKNOWN";

const page = (
  nodes: [number, GraphqlMergeable][],
  endCursor: string | null = null,
) => ({
  repository: {
    pullRequests: {
      pageInfo: { hasNextPage: endCursor !== null, endCursor },
      nodes: nodes.map(([number, mergeable]) => ({
        number,
        databaseId: number * 100,
        mergeable,
      })),
    },
  },
});

/** a refresh chains more promises than a timer advance settles: a real macrotask drains them */
const advance = async (ms: number): Promise<void> => {
  await vi.advanceTimersByTimeAsync(ms);
  await new Promise((resolve) => {
    setImmediate(resolve);
  });
};

let repoId = 0;

const createOptions = () => {
  repoId += 1;
  const graphql = vi.fn();
  const partialUpdateMany = vi.fn(() => Promise.resolve());
  const log = { info: vi.fn(), error: vi.fn() };
  const context = {
    octokit: { graphql },
    repo: () => ({ owner: "reviewflow", repo: "reviewflow-test" }),
    log,
  } as any;
  const appContext = {
    mongoStores: { prs: { partialUpdateMany } },
  } as unknown as AppContext;
  const repoContext = {
    repoEmbed: { id: repoId, name: "reviewflow-test" },
    accountEmbed: { id: 1 },
    lockPullRequest: (
      _eventName: string,
      _pr: unknown,
      callback: () => Promise<void>,
    ) => callback(),
  } as unknown as RepoContext;

  return {
    options: { context, appContext, repoContext },
    graphql,
    partialUpdateMany,
    log,
  };
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  vi.mocked(fetchPr).mockReset();
  vi.mocked(markMergeConflictAsDone).mockClear();
  vi.mocked(syncMergeConflictSlackMessage).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("scheduleMergeableRefresh on a base branch", () => {
  it("stores what github computed and retries only the pull requests still unknown", async () => {
    const { options, graphql, partialUpdateMany } = createOptions();
    graphql
      .mockResolvedValueOnce(
        page([
          [1, "UNKNOWN"],
          [2, "CONFLICTING"],
          [3, "MERGEABLE"],
        ]),
      )
      .mockResolvedValueOnce(
        page([
          [1, "CONFLICTING"],
          [2, "CONFLICTING"],
          [3, "MERGEABLE"],
        ]),
      );
    vi.mocked(fetchPr).mockImplementation((_context, prNumber) =>
      Promise.resolve({ number: prNumber } as any),
    );

    scheduleMergeableRefresh(options, { baseRef: "main" });
    await advance(9999);
    expect(graphql).not.toHaveBeenCalled();

    await advance(1);
    expect(graphql).toHaveBeenCalledWith(expect.any(String), {
      owner: "reviewflow",
      repo: "reviewflow-test",
      baseRefName: "main",
      after: null,
    });
    expect(partialUpdateMany).toHaveBeenCalledWith(
      { "account.id": 1, "repo.id": repoId, "pr.number": 2 },
      { $set: { mergeable: "conflicting" } },
    );
    expect(partialUpdateMany).toHaveBeenCalledWith(
      { "account.id": 1, "repo.id": repoId, "pr.number": 3 },
      { $set: { mergeable: "mergeable" } },
    );
    expect(fetchPr).toHaveBeenCalledTimes(1);
    expect(syncMergeConflictSlackMessage).toHaveBeenCalledWith(
      options.appContext,
      options.repoContext,
      { pullRequest: { number: 2 }, mergeable: "conflicting" },
    );
    expect(markMergeConflictAsDone).toHaveBeenCalledWith(
      options.appContext,
      options.repoContext,
      300,
    );

    await advance(30_000);
    expect(graphql).toHaveBeenCalledTimes(2);
    expect(fetchPr).toHaveBeenCalledTimes(2);
    expect(fetchPr).toHaveBeenLastCalledWith(options.context, 1);
    expect(markMergeConflictAsDone).toHaveBeenCalledTimes(1);
  });

  it("gives up after three attempts", async () => {
    const { options, graphql, log } = createOptions();
    graphql.mockResolvedValue(page([[1, "UNKNOWN"]]));

    scheduleMergeableRefresh(options, { baseRef: "main" });
    await advance(10_000);
    await advance(30_000);
    await advance(90_000);
    await advance(600_000);

    expect(graphql).toHaveBeenCalledTimes(3);
    expect(log.info).toHaveBeenCalledWith(
      { key: `${repoId}:main`, prNumbers: [1] },
      "mergeable still unknown, giving up",
    );
  });

  it("replaces a pending refresh of the same branch", async () => {
    const { options, graphql } = createOptions();
    graphql.mockResolvedValue(page([[1, "MERGEABLE"]]));

    scheduleMergeableRefresh(options, { baseRef: "main" });
    await advance(5000);
    scheduleMergeableRefresh(options, { baseRef: "main" });
    await advance(5000);
    expect(graphql).not.toHaveBeenCalled();

    await advance(5000);
    expect(graphql).toHaveBeenCalledTimes(1);
  });

  it("reads every page", async () => {
    const { options, graphql, partialUpdateMany } = createOptions();
    graphql
      .mockResolvedValueOnce(page([[1, "MERGEABLE"]], "cursor-1"))
      .mockResolvedValueOnce(page([[2, "MERGEABLE"]]));

    scheduleMergeableRefresh(options, { baseRef: "main" });
    await advance(10_000);

    expect(graphql).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({ after: "cursor-1" }),
    );
    expect(partialUpdateMany).toHaveBeenCalledTimes(2);
  });

  it("logs a failed read instead of throwing", async () => {
    const { options, graphql, log } = createOptions();
    const error = new Error("boom");
    graphql.mockRejectedValue(error);

    scheduleMergeableRefresh(options, { baseRef: "main" });
    await advance(10_000);

    expect(log.error).toHaveBeenCalledWith(
      { err: error, key: `${repoId}:main` },
      "mergeable refresh failed",
    );
  });
});

describe("scheduleMergeableRefresh on a pull request", () => {
  it("reads the pull request again until github has computed it", async () => {
    const { options, graphql, partialUpdateMany } = createOptions();
    const conflicting = { number: 30, mergeable: false };
    vi.mocked(fetchPr)
      .mockResolvedValueOnce({ number: 30, mergeable: null } as any)
      .mockResolvedValueOnce(conflicting as any);

    scheduleMergeableRefresh(options, { prNumber: 30 });
    await advance(10_000);
    expect(syncMergeConflictSlackMessage).not.toHaveBeenCalled();

    await advance(30_000);
    expect(graphql).not.toHaveBeenCalled();
    expect(partialUpdateMany).toHaveBeenCalledWith(
      { "account.id": 1, "repo.id": repoId, "pr.number": 30 },
      { $set: { mergeable: "conflicting" } },
    );
    expect(syncMergeConflictSlackMessage).toHaveBeenCalledWith(
      options.appContext,
      options.repoContext,
      { pullRequest: conflicting, mergeable: "conflicting" },
    );
  });
});
