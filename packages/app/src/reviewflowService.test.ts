/* oxlint-disable typescript/require-await, unicorn/no-await-expression-member, typescript/consistent-type-assertions, eslint/object-shorthand, eslint/func-names, eslint/no-loop-func, eslint/no-bitwise */
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type {
  ReviewflowClient,
  ReviewflowGroup,
  ReviewflowPrDetail,
  ReviewflowStreamEvent,
} from "@reviewflow/sdk";
import { boardReadDelayMs, fail, lingerMs } from "@reviewflow/sdk";
import { createMemoryCredentialKey } from "./credentials/memoryKey.test-utils.ts";
import { createFileCredentialStore } from "./credentials/store.ts";
import { heartbeatMs } from "./eventStream.ts";
import { createReviewflowService } from "./reviewflowService.ts";
import { routeApiRequest } from "./routes.ts";
import type { PullRequestOperations, RouteDeps } from "./routes.ts";

const token = "tok-very-secret-123";
const url = "https://reviewflow.example.com";

let home: string;

beforeEach(() => {
  vi.useFakeTimers();
  home = mkdtempSync(join(tmpdir(), "reviewflow-app-service-"));
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  rmSync(home, { recursive: true, force: true });
});

const detail = (
  overrides: Partial<ReviewflowPrDetail> = {},
): ReviewflowPrDetail => ({
  id: "rf-1",
  ownerRepo: "acme/repo",
  number: 1,
  title: "a pull request",
  url: "https://github.com/acme/repo/pull/1",
  headRef: "feat",
  baseRef: "main",
  headSha: "abc",
  baseSha: "def",
  state: "open",
  reviewState: "requested",
  author: "me",
  checks: {
    conclusion: "passed",
    passed: 1,
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
  updatedAt: "2026-11-06T09:00:00.000Z",
  ...overrides,
});

const groupsOf = (prs: ReviewflowPrDetail[]): ReviewflowGroup[] => [
  {
    key: "mine",
    title: "Mine",
    buckets: [{ key: "review", title: "Review", total: prs.length, prs }],
  },
];

/** pushes events into the stream the service opens */
const fakeStream = () => {
  const queue: ReviewflowStreamEvent[] = [];
  let wake: (() => void) | null = null;
  const opened: AbortSignal[] = [];
  return {
    opened,
    push: (event: ReviewflowStreamEvent) => {
      queue.push(event);
      wake?.();
    },
    open: async function* (_connection: unknown, signal: AbortSignal) {
      opened.push(signal);
      for (;;) {
        if (signal.aborted) return;
        const next = queue.shift();
        if (next !== undefined) {
          yield next;
          continue;
        }
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
      }
    },
  };
};

const setup = (client: Partial<ReviewflowClient> = {}) => {
  const stream = fakeStream();
  const store = createFileCredentialStore(
    createMemoryCredentialKey(),
    join(home, "credentials.json"),
  );
  const fullClient: ReviewflowClient = {
    me: vi.fn(async () => ({
      login: "me",
      accounts: [
        { login: "me", type: "User" as const },
        { login: "acme", type: "Organization" as const },
      ],
    })),
    lookup: vi.fn(async () => []),
    board: vi.fn(async (account: string) =>
      groupsOf(account === "acme" ? [detail()] : []),
    ),
    closedPrs: vi.fn(async () => ({ total: 0, prs: [] })),
    pr: vi.fn(async () => null),
    ...client,
  };
  const createClient = vi.fn(() => fullClient);
  const service = createReviewflowService({
    store,
    createClient,
    openStream: stream.open,
    now: () => new Date("2026-11-06T10:00:00.000Z"),
  });
  return { service, stream, store, client: fullClient, createClient };
};

const flush = async (): Promise<void> => {
  await vi.advanceTimersByTimeAsync(0);
};

const frames = (writes: string[]): { event: string; data: any }[] =>
  writes
    .filter((chunk) => chunk.startsWith("event:"))
    .map((chunk) => {
      const [event, data] = chunk.trimEnd().split("\n");
      return {
        event: event!.slice("event: ".length),
        data: JSON.parse(data!.slice("data: ".length)),
      };
    });

describe("token", () => {
  test("is verified before it is stored, and stored with what me() answered", async () => {
    const { service, client, store } = setup();
    const status = await service.setToken({ url: `${url}/settings`, token });
    expect(client.me).toHaveBeenCalledTimes(1);
    expect(status).toEqual({
      configured: true,
      url,
      login: "me",
      accounts: ["me", "acme"],
      stream: "off",
      error: null,
    });
    expect(store.read().reviewflow?.token).toBe(token);
    expect(JSON.stringify(status)).not.toContain(token);
    service.close();
  });

  test("a refusal stores nothing and never carries the token", async () => {
    const { service, store } = setup({
      me: async () => {
        throw fail(`reviewflow answered 401 for Bearer ${token}`, {
          status: 401,
        });
      },
    });
    const error = await service
      .setToken({ url, token })
      .catch((error_: unknown) => error_ as Error);
    expect((error as Error).message).toMatch(/refused the token/);
    expect((error as Error).message).not.toContain(token);
    expect(store.read().reviewflow).toBeUndefined();
    expect(service.status().configured).toBe(false);
  });

  test("a url that is not a server address is refused before any call", async () => {
    const { service, client } = setup();
    await expect(service.setToken({ url: "nope", token })).rejects.toThrow(
      /server's address/,
    );
    expect(client.me).not.toHaveBeenCalled();
  });

  test("http is refused for a remote server, kept for this machine", async () => {
    const { service, client } = setup();
    await expect(
      service.setToken({ url: "http://reviewflow.example.com", token }),
    ).rejects.toThrow(/must be https/);
    expect(client.me).not.toHaveBeenCalled();
    await expect(
      service.setToken({ url: "http://localhost:3000", token }),
    ).resolves.toMatchObject({ url: "http://localhost:3000" });
    service.close();
  });

  test("clearing forgets it", async () => {
    const { service, store } = setup();
    await service.setToken({ url, token });
    expect(service.clearToken().configured).toBe(false);
    expect(store.read().reviewflow).toBeUndefined();
  });

  test("an unreadable credentials file is reported in the status, not as no token", () => {
    const { service, store } = setup();
    vi.spyOn(store, "read").mockImplementation(() => {
      throw new Error("credentials.json is not valid json");
    });
    expect(service.status()).toMatchObject({
      configured: false,
      error: "credentials.json is not valid json",
    });
  });

  test("the file on disk is 0600, encrypted, and holds no clear token", async () => {
    const { service } = setup();
    await service.setToken({ url, token });
    const file = join(home, "credentials.json");
    const raw = readFileSync(file, "utf8");
    expect(raw).not.toContain(token);
    expect(JSON.parse(raw)).toMatchObject({ encrypted: "aes-256-gcm" });
    expect(statSync(file).mode & 0o777).toBe(0o600);
    service.close();
  });
});

describe("board", () => {
  test("is empty without a token", async () => {
    const { service, client } = setup();
    expect(await service.board(false)).toEqual({ board: null, viewer: null });
    expect(client.board).not.toHaveBeenCalled();
  });

  test("is read once when empty, held in memory, and read again on refresh", async () => {
    const { service, client } = setup();
    await service.setToken({ url, token });
    const first = await service.board(false);
    expect(first.viewer).toBe("me");
    expect(first.board?.groups[0]?.buckets[0]?.prs).toHaveLength(1);
    expect(first.board?.fetchedAt).toBe("2026-11-06T10:00:00.000Z");
    await service.board(false);
    expect(client.board).toHaveBeenCalledTimes(2); // me + acme, once
    await service.board(true);
    expect(client.board).toHaveBeenCalledTimes(4);
  });

  test("fails with the reason when every account fails", async () => {
    const { service } = setup({
      board: async () => {
        throw fail("reviewflow answered 503");
      },
    });
    await service.setToken({ url, token });
    await expect(service.board(false)).rejects.toThrow(/503/);
  });

  test("drops a read still running when the token is forgotten", async () => {
    const answers: (() => void)[] = [];
    const { service } = setup({
      board: vi.fn(
        async (account: string) =>
          new Promise<ReturnType<typeof groupsOf>>((resolve) => {
            answers.push(() => {
              resolve(groupsOf(account === "acme" ? [detail()] : []));
            });
          }),
      ),
    });
    await service.setToken({ url, token });
    const writes: string[] = [];
    const unsubscribe = service.subscribe((chunk) => writes.push(chunk));
    const reading = service.board(true);
    await flush();
    service.clearToken();
    writes.length = 0;
    for (const answer of answers) answer();
    await reading;

    expect(frames(writes).filter(({ event }) => event === "board")).toEqual([]);
    expect(await service.board(false)).toEqual({ board: null, viewer: null });
    unsubscribe();
    service.close();
  });

  test("reads again for a new token instead of waiting on the old token's read", async () => {
    const board = vi.fn(
      async (_account: string) =>
        new Promise<ReturnType<typeof groupsOf>>(() => {}),
    );
    const { service, client } = setup({ board });
    await service.setToken({ url, token });
    service.board(true).catch(() => undefined);
    await flush();
    expect(board).toHaveBeenCalledTimes(2);
    await service.setToken({ url, token: "another-token" });
    service.board(true).catch(() => undefined);
    await flush();
    expect(client.board).toHaveBeenCalledTimes(4);
    service.close();
  });
});

describe("pr", () => {
  test("is null without a token, reviewflow not asked", async () => {
    const { service, client } = setup();
    expect(
      await service.pr({ ownerRepo: "acme/storefront", number: 1 }),
    ).toEqual({ pr: null });
    expect(client.pr).not.toHaveBeenCalled();
  });

  test("answers reviewflow's copy of the pull request", async () => {
    const { service, client } = setup({ pr: vi.fn(async () => detail()) });
    await service.setToken({ url, token });
    const answer = await service.pr({
      ownerRepo: "acme/storefront",
      number: 1,
    });
    expect(answer.pr).toEqual(detail());
    expect(client.pr).toHaveBeenCalledWith("acme/storefront", 1);
  });

  test("fails with the reason, never the token", async () => {
    const { service } = setup({
      pr: async () => {
        throw fail(`reviewflow answered 503 ${token}`);
      },
    });
    await service.setToken({ url, token });
    const read = service.pr({ ownerRepo: "acme/storefront", number: 1 });
    await expect(read).rejects.toThrow(/503/);
    await expect(read).rejects.not.toThrow(token);
  });
});

describe("closedPullRequests", () => {
  test("is empty without a token and reads nothing", async () => {
    const { service, client } = setup();

    expect(await service.closedPullRequests(null)).toEqual({
      total: 0,
      prs: [],
      viewer: null,
    });
    expect(client.closedPrs).not.toHaveBeenCalled();
  });

  test("answers board rows, for the account asked", async () => {
    const { service, client } = setup({
      closedPrs: vi.fn(async () => ({ total: 7, prs: [detail()] })),
    });
    await service.setToken({ url: "https://rf.example", token: "rfp_x" });

    const answer = await service.closedPullRequests("acme");

    expect(client.closedPrs).toHaveBeenCalledWith("acme");
    expect(answer).toMatchObject({ total: 7, viewer: "me" });
    expect(answer.prs).toHaveLength(1);
  });
});

describe("lookup", () => {
  const targets = [{ ownerRepo: "acme/storefront", headRef: "feat/x" }];

  test("is null without a token, reviewflow not asked", async () => {
    const { service, client } = setup();
    expect(await service.lookup(targets)).toBeNull();
    expect(client.lookup).not.toHaveBeenCalled();
  });

  test("answers reviewflow's results, in the targets' order", async () => {
    const { service, client } = setup({
      lookup: vi.fn(async () => [{ found: true as const, pr: detail() }]),
    });
    await service.setToken({ url, token });
    expect(await service.lookup(targets)).toEqual([
      { found: true, pr: detail() },
    ]);
    expect(client.lookup).toHaveBeenCalledWith(targets);
  });

  test("fails with the reason, never the token", async () => {
    const { service } = setup({
      lookup: async () => {
        throw fail(`reviewflow answered 503 ${token}`);
      },
    });
    await service.setToken({ url, token });
    const read = service.lookup(targets);
    await expect(read).rejects.toThrow(/503/);
    await expect(read).rejects.not.toThrow(token);
  });
});

describe("events", () => {
  test("a connection gets the status first, and starts the follow", async () => {
    const { service, stream } = setup();
    await service.setToken({ url, token });
    const writes: string[] = [];
    const close = service.subscribe((chunk) => writes.push(chunk));
    await flush();
    expect(frames(writes)[0]).toMatchObject({
      event: "reviewflowStatus",
      data: { configured: true },
    });
    expect(stream.opened).toHaveLength(1);
    expect(JSON.stringify(writes)).not.toContain(token);
    close();
    service.close();
  });

  test("never follows without a connection", async () => {
    const { service, stream } = setup();
    await service.setToken({ url, token });
    await vi.advanceTimersByTimeAsync(2 * lingerMs);
    expect(stream.opened).toHaveLength(0);
    service.close();
  });

  test("stops lingerMs after the last connection closes", async () => {
    const { service, stream } = setup();
    await service.setToken({ url, token });
    const closeA = service.subscribe(() => undefined);
    const closeB = service.subscribe(() => undefined);
    await flush();
    closeA();
    await vi.advanceTimersByTimeAsync(2 * lingerMs);
    expect(stream.opened[0]!.aborted).toBe(false);
    closeB();
    await vi.advanceTimersByTimeAsync(lingerMs);
    expect(stream.opened[0]!.aborted).toBe(true);
    service.close();
  });

  test("heartbeats every 25s", async () => {
    const { service } = setup();
    const writes: string[] = [];
    const close = service.subscribe((chunk) => writes.push(chunk));
    await vi.advanceTimersByTimeAsync(heartbeatMs * 2);
    expect(writes.filter((chunk) => chunk.startsWith(":"))).toHaveLength(2);
    close();
    await vi.advanceTimersByTimeAsync(heartbeatMs * 2);
    expect(writes.filter((chunk) => chunk.startsWith(":"))).toHaveLength(2);
  });

  test("a stream pr updates the board and emits board, then pullRequestChanged on a real change", async () => {
    const { service, stream } = setup();
    await service.setToken({ url, token });
    await service.board(false);
    const writes: string[] = [];
    const close = service.subscribe((chunk) => writes.push(chunk));
    await flush();
    stream.push({ type: "pr", pr: detail() });
    stream.push({ type: "ready" });
    await flush();
    await vi.advanceTimersByTimeAsync(boardReadDelayMs);
    writes.length = 0;

    stream.push({ type: "pr", pr: detail({ title: "renamed" }) });
    await flush();
    let seen = frames(writes);
    expect(seen.map((f) => f.event)).toContain("board");
    expect(
      seen.find((f) => f.event === "board")!.data.board.groups[0].buckets[0]
        .prs[0].title,
    ).toBe("renamed");

    writes.length = 0;
    stream.push({
      type: "pr",
      pr: detail({ title: "renamed", headSha: "new" }),
    });
    await flush();
    seen = frames(writes);
    const changed = seen.find((f) => f.event === "pullRequestChanged");
    expect(changed?.data).toMatchObject({ ownerRepo: "acme/repo", number: 1 });
    expect(changed?.data.parts).toContain("commits");
    close();
    service.close();
  });

  test("a removal drops the row and emits board", async () => {
    const { service, stream } = setup();
    await service.setToken({ url, token });
    await service.board(false);
    const writes: string[] = [];
    const close = service.subscribe((chunk) => writes.push(chunk));
    await flush();
    stream.push({ type: "pr", pr: detail() });
    stream.push({ type: "ready" });
    await flush();
    writes.length = 0;
    stream.push({ type: "prRemoved", id: "rf-1" });
    await flush();
    const board = frames(writes).find((f) => f.event === "board");
    expect(board?.data.board.groups[0].buckets[0].prs).toEqual([]);
    close();
    service.close();
  });

  test("the status is emitted when the stream goes live", async () => {
    const { service, stream } = setup();
    await service.setToken({ url, token });
    const writes: string[] = [];
    const close = service.subscribe((chunk) => writes.push(chunk));
    await flush();
    stream.push({ type: "ready" });
    await flush();
    const statuses = frames(writes).filter(
      (f) => f.event === "reviewflowStatus",
    );
    expect(statuses.at(-1)?.data.stream).toBe("live");
    close();
    service.close();
  });
});

describe("routes", () => {
  const deps = (service: ReturnType<typeof setup>["service"]): RouteDeps => ({
    transport: {} as never,
    operations: {} as PullRequestOperations,
    configPath: join(home, "config.json"),
    reviewflow: service,
  });
  const call = async (
    service: ReturnType<typeof setup>["service"],
    method: string,
    path: string,
    json?: unknown,
  ) => {
    const parsed = new URL(path, "http://localhost");
    const routed = routeApiRequest(deps(service), {
      method,
      pathname: parsed.pathname,
      query: parsed.searchParams,
      readJson: async () => json,
    });
    return routed === null ? null : await routed;
  };

  test("PUT stores, GET status never returns the token, DELETE forgets", async () => {
    const { service } = setup();
    const put = await call(service, "PUT", "/api/reviewflow/token", {
      url,
      token,
    });
    expect(put?.status).toBe(200);
    const status = await call(service, "GET", "/api/reviewflow/status");
    expect(status?.body).toMatchObject({ configured: true, login: "me" });
    expect(JSON.stringify([put, status])).not.toContain(token);
    const del = await call(service, "DELETE", "/api/reviewflow/token");
    expect(del?.body).toMatchObject({ configured: false });
  });

  test("a refused token answers 400 with the reason and not the token", async () => {
    const { service } = setup({
      me: async () => {
        throw fail(`reviewflow answered 401 ${token}`, { status: 401 });
      },
    });
    const answer = await call(service, "PUT", "/api/reviewflow/token", {
      url,
      token,
    });
    expect(answer?.status).toBe(400);
    expect(JSON.stringify(answer)).not.toContain(token);
    expect(JSON.stringify(answer)).toMatch(/refused the token/);
  });

  test("validates the body and the method", async () => {
    const { service } = setup();
    expect(
      (await call(service, "PUT", "/api/reviewflow/token", { url }))?.status,
    ).toBe(400);
    expect(
      (await call(service, "PUT", "/api/reviewflow/token", { token }))?.status,
    ).toBe(400);
    expect(
      (await call(service, "PUT", "/api/reviewflow/token", null))?.status,
    ).toBe(400);
    expect((await call(service, "POST", "/api/reviewflow/token"))?.status).toBe(
      405,
    );
    expect((await call(service, "POST", "/api/events"))?.status).toBe(405);
  });

  test("board answers the response shape, ?refresh=1 reads again", async () => {
    const { service, client } = setup();
    await call(service, "PUT", "/api/reviewflow/token", { url, token });
    const answer = await call(service, "GET", "/api/reviewflow/board");
    expect(answer?.body).toMatchObject({
      viewer: "me",
      board: { groups: [{ key: "mine" }] },
    });
    const before = vi.mocked(client.board).mock.calls.length;
    await call(service, "GET", "/api/reviewflow/board?refresh=1");
    expect(vi.mocked(client.board).mock.calls.length).toBe(before + 2);
  });

  test("/api/reviewflow/pr validates the ref and answers 502 when reviewflow fails", async () => {
    const { service } = setup({
      pr: async () => {
        throw fail("reviewflow answered 503");
      },
    });
    expect(
      (await call(service, "GET", "/api/reviewflow/pr?repo=acme&number=1"))
        ?.status,
    ).toBe(400);
    expect(
      (
        await call(
          service,
          "GET",
          "/api/reviewflow/pr?repo=acme/storefront&number=1",
        )
      )?.body,
    ).toEqual({ pr: null });
    await call(service, "PUT", "/api/reviewflow/token", { url, token });
    expect(
      (
        await call(
          service,
          "GET",
          "/api/reviewflow/pr?repo=acme/storefront&number=1",
        )
      )?.status,
    ).toBe(502);
  });

  test("/api/events answers an event stream", async () => {
    const { service } = setup();
    const answer = await call(service, "GET", "/api/events");
    expect(answer?.status).toBe(200);
    expect(typeof answer?.events).toBe("function");
  });
});
