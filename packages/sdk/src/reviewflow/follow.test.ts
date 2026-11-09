/* oxlint-disable typescript/require-await, eslint/object-shorthand, eslint/func-names, eslint/no-loop-func, typescript/only-throw-error */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PullRequestChange } from "../api/pullRequest.ts";
import type { ReviewflowGroup, ReviewflowPrDetail } from "./client.ts";
import { fail } from "./client.ts";
import type { ReviewflowConnection, ReviewflowFollowerLog } from "./follow.ts";
import {
  boardReadDelayMs,
  createReviewflowFollower,
  lingerMs,
  maxRetryMs,
} from "./follow.ts";
import type { ReviewflowStreamEvent } from "./stream.ts";

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

/** a stream the test pushes events into */
const createFakeStream = () => {
  const queue: ReviewflowStreamEvent[] = [];
  let wake: (() => void) | null = null;
  let failure: Error | null = null;
  let finished = false;
  const opened: AbortSignal[] = [];
  return {
    opened,
    push: (event: ReviewflowStreamEvent): void => {
      queue.push(event);
      wake?.();
    },
    fail: (error: Error): void => {
      failure = error;
      wake?.();
    },
    finish: (): void => {
      finished = true;
      wake?.();
    },
    events: async function* (signal: AbortSignal) {
      opened.push(signal);
      failure = null;
      finished = false;
      for (;;) {
        if (signal.aborted) return;
        if (failure !== null) throw failure;
        const next = queue.shift();
        if (next !== undefined) {
          yield next;
          continue;
        }
        if (finished) return;
        await new Promise<void>((resolve) => {
          wake = resolve;
          signal.addEventListener(
            "abort",
            () => {
              resolve();
            },
            { once: true },
          );
        });
        wake = null;
      }
    },
  };
};

const groups: ReviewflowGroup[] = [];

const setup = () => {
  const stream = createFakeStream();
  const board = vi.fn(async (_account: string) => groups);
  const logs: ReviewflowFollowerLog[] = [];
  const connection: ReviewflowConnection = {
    client: { board },
    events: stream.events,
  };
  const connect = vi.fn((): ReviewflowConnection | null => connection);
  const changes: PullRequestChange[] = [];
  const states: string[] = [];
  const prs: [string, string][] = [];
  const removed: string[] = [];
  const read: string[] = [];
  const follower = createReviewflowFollower({
    connect,
    accounts: () => ["acme"],
    onPr: (pr, phase) => prs.push([pr.id, phase]),
    onPrRemoved: (id) => removed.push(id),
    onAccountBoard: (account) => read.push(account),
    onPullRequestChanged: (change) => changes.push(change),
    onStateChanged: (state) => states.push(state),
    onLog: (entry) => logs.push(entry),
  });
  return {
    logs,
    stream,
    board,
    connect,
    changes,
    states,
    prs,
    removed,
    read,
    follower,
  };
};

const flush = async (): Promise<void> => {
  await vi.advanceTimersByTimeAsync(0);
};

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("follow lifecycle", () => {
  it("never opens a stream without a watcher", async () => {
    const { connect, follower } = setup();
    await vi.advanceTimersByTimeAsync(10 * lingerMs);
    expect(connect).not.toHaveBeenCalled();
    expect(follower.state()).toBe("off");
  });

  it("opens on the first watcher and stays one stream for more", async () => {
    const { stream, follower } = setup();
    follower.setWatched(true);
    follower.setWatched(true);
    await flush();
    expect(stream.opened).toHaveLength(1);
    expect(follower.state()).toBe("connecting");
    follower.close();
  });

  it("closes lingerMs after the last watcher, not before", async () => {
    const { stream, follower, states } = setup();
    follower.setWatched(true);
    await flush();
    follower.setWatched(false);
    await vi.advanceTimersByTimeAsync(lingerMs - 1);
    expect(stream.opened[0]!.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(stream.opened[0]!.aborted).toBe(true);
    expect(follower.state()).toBe("off");
    expect(states.at(-1)).toBe("off");
  });

  it("a watcher back within the linger keeps the stream", async () => {
    const { stream, follower } = setup();
    follower.setWatched(true);
    await flush();
    follower.setWatched(false);
    await vi.advanceTimersByTimeAsync(lingerMs - 1000);
    follower.setWatched(true);
    await vi.advanceTimersByTimeAsync(lingerMs);
    expect(stream.opened).toHaveLength(1);
    expect(stream.opened[0]!.aborted).toBe(false);
    follower.close();
  });

  it("stays off when no connection is configured", async () => {
    const { connect, follower } = setup();
    connect.mockReturnValue(null);
    follower.setWatched(true);
    await flush();
    expect(follower.state()).toBe("off");
  });

  it("reconnects with a growing backoff after a failure, and reports the error", async () => {
    const { stream, follower, states } = setup();
    follower.setWatched(true);
    await flush();
    stream.fail(fail("boom"));
    await flush();
    expect(follower.state()).toBe("error");
    await vi.advanceTimersByTimeAsync(1999);
    expect(stream.opened).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(stream.opened).toHaveLength(2);
    stream.fail(fail("boom"));
    await flush();
    await vi.advanceTimersByTimeAsync(3999);
    expect(stream.opened).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(stream.opened).toHaveLength(3);
    expect(states).toContain("error");
    follower.close();
  });

  it("waits the longest for a revoked token", async () => {
    const { stream, follower } = setup();
    follower.setWatched(true);
    await flush();
    stream.fail(fail("revoked", { status: 401 }));
    await flush();
    await vi.advanceTimersByTimeAsync(maxRetryMs - 1);
    expect(stream.opened).toHaveLength(1);
    follower.close();
  });

  it("starts the backoff over once a stream reached ready", async () => {
    const { stream, follower } = setup();
    follower.setWatched(true);
    await flush();
    stream.fail(fail("boom"));
    await flush();
    await vi.advanceTimersByTimeAsync(2000);
    stream.fail(fail("boom"));
    await flush();
    await vi.advanceTimersByTimeAsync(4000);
    expect(stream.opened).toHaveLength(3);
    stream.push({ type: "ready" });
    await flush();
    stream.fail(fail("boom"));
    await flush();
    await vi.advanceTimersByTimeAsync(1999);
    expect(stream.opened).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(stream.opened).toHaveLength(4);
    follower.close();
  });

  it("backs off from a stream that ends before ready", async () => {
    const { stream, follower, logs } = setup();
    follower.setWatched(true);
    await flush();
    stream.push({ type: "end", reason: "reset" });
    await flush();
    await vi.advanceTimersByTimeAsync(1999);
    expect(stream.opened).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(stream.opened).toHaveLength(2);
    stream.push({ type: "end", reason: "reset" });
    await flush();
    await vi.advanceTimersByTimeAsync(3999);
    expect(stream.opened).toHaveLength(2);
    expect(logs.at(-1)).toEqual({
      level: "warn",
      message: "reviewflow ended the stream before it was ready",
      fields: { retryInMs: 4000 },
    });
    follower.close();
  });

  it("removes its abort listener after each reconnect delay", async () => {
    const added = vi.spyOn(AbortSignal.prototype, "addEventListener");
    const removed = vi.spyOn(AbortSignal.prototype, "removeEventListener");
    const { stream, follower } = setup();
    follower.setWatched(true);
    await flush();
    stream.fail(fail("boom"));
    await flush();
    await vi.advanceTimersByTimeAsync(2000);
    const waitListener = added.mock.calls.find(
      ([type, listener]) =>
        type === "abort" &&
        removed.mock.calls.some(([, other]) => other === listener),
    );
    expect(waitListener).toBeDefined();
    follower.close();
    added.mockRestore();
    removed.mockRestore();
  });
});

describe("follow logs", () => {
  it("logs a failed stream as a warn carrying the error itself and the retry delay", async () => {
    const { stream, follower, logs } = setup();
    follower.setWatched(true);
    await flush();
    const failure = fail("boom");
    stream.fail(failure);
    await flush();
    expect(logs).toEqual([
      {
        level: "warn",
        message: "reviewflow stream failed",
        error: failure,
        fields: { retryInMs: 2000 },
      },
    ]);
    expect(logs[0]?.error).toBe(failure);
    follower.close();
  });

  it("logs ready and an end as info, with no error", async () => {
    const { stream, follower, logs } = setup();
    follower.setWatched(true);
    await flush();
    stream.push({ type: "pr", pr: detail() });
    stream.push({ type: "ready" });
    stream.push({ type: "end", reason: "scopeChanged" });
    await flush();
    expect(logs).toEqual([
      {
        level: "info",
        message: "reviewflow stream ready",
        fields: { prs: 1 },
      },
      {
        level: "info",
        message: "reviewflow ended the stream",
        fields: { reason: "scopeChanged" },
      },
    ]);
    follower.close();
  });

  it("logs a stream that stopped for good as an error carrying the thrown value", async () => {
    const failure = new Error("connect blew up");
    const logs: ReviewflowFollowerLog[] = [];
    const follower = createReviewflowFollower({
      connect: () => {
        throw failure;
      },
      accounts: () => [],
      onPr: () => undefined,
      onPrRemoved: () => undefined,
      onAccountBoard: () => undefined,
      onLog: (entry) => logs.push(entry),
    });
    follower.setWatched(true);
    await flush();
    expect(logs).toEqual([
      { level: "error", message: "reviewflow stream stopped", error: failure },
    ]);
    follower.close();
  });
});

describe("follow events", () => {
  it("reports the scope at ready, goes live and reads the boards", async () => {
    const { stream, follower, prs, board, read, states } = setup();
    follower.setWatched(true);
    await flush();
    stream.push({ type: "pr", pr: detail({ id: "a" }) });
    await flush();
    expect(prs).toEqual([]);
    stream.push({ type: "ready" });
    await flush();
    expect(prs).toEqual([["a", "scope"]]);
    expect(states).toContain("live");
    await vi.advanceTimersByTimeAsync(boardReadDelayMs);
    expect(board).toHaveBeenCalledWith("acme");
    expect(read).toEqual(["acme"]);
    follower.close();
  });

  it("emits a change with the stale parts, and none when nothing moved", async () => {
    const { stream, follower, changes, prs } = setup();
    follower.setWatched(true);
    await flush();
    stream.push({ type: "pr", pr: detail() });
    stream.push({ type: "ready" });
    await flush();
    stream.push({ type: "pr", pr: detail() });
    await flush();
    expect(changes).toEqual([]);
    stream.push({ type: "pr", pr: detail({ headSha: "new" }) });
    await flush();
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ ownerRepo: "owner/repo", number: 12 });
    expect(changes[0]!.parts).toContain("commits");
    expect(prs.at(-1)).toEqual(["rf-12", "change"]);
    follower.close();
  });

  it("coalesces a burst into one board read", async () => {
    const { stream, follower, board } = setup();
    follower.setWatched(true);
    await flush();
    stream.push({ type: "ready" });
    await flush();
    await vi.advanceTimersByTimeAsync(boardReadDelayMs);
    board.mockClear();
    for (let i = 0; i < 5; i++) {
      stream.push({
        type: "pr",
        pr: detail({ ownerRepo: "acme/x", title: `t${String(i)}` }),
      });
    }
    await flush();
    await vi.advanceTimersByTimeAsync(boardReadDelayMs);
    expect(board).toHaveBeenCalledTimes(1);
    follower.close();
  });

  it("reports a removal and reads that account's board", async () => {
    const { stream, follower, removed, board } = setup();
    follower.setWatched(true);
    await flush();
    stream.push({ type: "pr", pr: detail({ id: "a", ownerRepo: "acme/x" }) });
    stream.push({ type: "ready" });
    await flush();
    await vi.advanceTimersByTimeAsync(boardReadDelayMs);
    board.mockClear();
    stream.push({ type: "prRemoved", id: "a" });
    await flush();
    expect(removed).toEqual(["a"]);
    await vi.advanceTimersByTimeAsync(boardReadDelayMs);
    expect(board).toHaveBeenCalledTimes(1);
    follower.close();
  });

  it("reads the boards again when reviewflow resets the scope", async () => {
    const { stream, follower, board } = setup();
    follower.setWatched(true);
    await flush();
    stream.push({ type: "ready" });
    await flush();
    await vi.advanceTimersByTimeAsync(boardReadDelayMs);
    board.mockClear();
    stream.push({ type: "end", reason: "scopeChanged" });
    await flush();
    await vi.advanceTimersByTimeAsync(boardReadDelayMs);
    expect(board).toHaveBeenCalledTimes(1);
    follower.close();
  });
});
