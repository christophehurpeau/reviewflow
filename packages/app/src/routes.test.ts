/* oxlint-disable typescript/require-await, typescript/no-useless-default-assignment, unicorn/no-await-expression-member */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import type { GitHubTransport } from "@reviewflow/sdk";
import type { ReviewflowService } from "./reviewflowService.ts";
import type { PullRequestOperations, RouteDeps } from "./routes.ts";
import { routeApiRequest } from "./routes.ts";

const sha = "a".repeat(40);
const other = "b".repeat(40);
const transport = {} satisfies Partial<GitHubTransport> as GitHubTransport;

let root: string;
let repo: string;
let configPath: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "reviewflow-app-routes-"));
  repo = join(root, "checkout");
  mkdirSync(repo);
  execFileSync("git", ["init", "--quiet"], { cwd: repo });
  execFileSync(
    "git",
    ["remote", "add", "origin", "https://github.com/acme/widgets.git"],
    { cwd: repo },
  );
  configPath = join(root, "config.json");
  writeFileSync(
    configPath,
    JSON.stringify({ repos: { "acme/widgets": repo } }),
  );
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

const makeDeps = (
  overrides: Partial<PullRequestOperations> = {},
): RouteDeps => ({
  transport,
  configPath,
  // oxlint-disable-next-line typescript/consistent-type-assertions
  reviewflow: {} as ReviewflowService,
  operations: {
    fetchPullRequestPart: vi.fn(async () => ({ part: "fake" })),
    fetchPullRequestCandidates: vi.fn(async () => ({ candidates: true })),
    fetchPullRequestRevisions: vi.fn(async () => ({ revisions: [] })),
    parsePullRequestEdit: vi.fn(() => ({ kind: "title", title: "t" })),
    editPullRequest: vi.fn(async () => null),
    readPullRequestDiff: vi.fn(async () => ({ source: "git" })),
    readFileAtSha: vi.fn(async () => "file body"),
    readReadingOrder: vi.fn(async () => ({ groups: [] })),
    readImpacts: vi.fn(async () => ({
      tooLarge: false,
      files: [],
      notAnalyzed: [],
      unresolvedIn: [],
    })),
    ...overrides,
  } as unknown as PullRequestOperations,
});

const call = async (
  deps: RouteDeps,
  method: string,
  url: string,
  json: unknown = undefined,
) => {
  const parsed = new URL(url, "http://localhost");
  const routed = routeApiRequest(deps, {
    method,
    pathname: parsed.pathname,
    query: parsed.searchParams,
    readJson: async () => json,
  });
  return routed === null ? null : await routed;
};

describe("routes", () => {
  test("unknown path is not routed", async () => {
    expect(await call(makeDeps(), "GET", "/api/prs/summary")).toBeNull();
    expect(await call(makeDeps(), "POST", "/api/prs/refresh")).toBeNull();
  });

  test("detail passes the transport, ref and part", async () => {
    const deps = makeDeps();
    const answer = await call(
      deps,
      "GET",
      "/api/prs/detail?repo=acme/widgets&number=3&part=checks",
    );
    expect(answer).toEqual({ status: 200, body: { part: "fake" } });
    expect(deps.operations.fetchPullRequestPart).toHaveBeenCalledWith(
      transport,
      { ownerRepo: "acme/widgets", number: 3 },
      "checks",
    );
  });

  test("validates repo, number, part and method", async () => {
    const deps = makeDeps();
    expect(
      (
        await call(
          deps,
          "GET",
          "/api/prs/detail?repo=nope&number=3&part=checks",
        )
      )?.status,
    ).toBe(400);
    expect(
      (await call(deps, "GET", "/api/prs/detail?repo=a/b&number=0&part=checks"))
        ?.status,
    ).toBe(400);
    expect(
      (await call(deps, "GET", "/api/prs/detail?repo=a/b&number=1&part=zzz"))
        ?.status,
    ).toBe(400);
    expect(
      (
        await call(
          deps,
          "POST",
          "/api/prs/detail?repo=a/b&number=1&part=checks",
        )
      )?.status,
    ).toBe(405);
    expect(
      (await call(deps, "GET", "/api/prs/revisions?repo=a/b&number=1"))?.status,
    ).toBe(400);
  });

  test("candidates and revisions", async () => {
    const deps = makeDeps();
    expect(
      (await call(deps, "GET", "/api/prs/candidates?repo=a/b&number=1"))?.body,
    ).toEqual({ candidates: true });
    await call(
      deps,
      "GET",
      "/api/prs/revisions?repo=a/b&number=1&subject=NODE",
    );
    expect(deps.operations.fetchPullRequestRevisions).toHaveBeenCalledWith(
      transport,
      "NODE",
    );
  });

  test("edit answers the kind and the follow-up error", async () => {
    const deps = makeDeps();
    const answer = await call(deps, "POST", "/api/prs/edit", {
      ownerRepo: "a/b",
      number: 2,
      edit: { kind: "title", title: "t" },
    });
    expect(answer).toEqual({
      status: 200,
      body: { edited: "title", followUpError: null },
    });
    expect((await call(deps, "GET", "/api/prs/edit"))?.status).toBe(405);
    expect((await call(deps, "POST", "/api/prs/edit", null))?.status).toBe(400);
    expect(
      (await call(deps, "POST", "/api/prs/edit", { ownerRepo: "x", number: 2 }))
        ?.status,
    ).toBe(400);
    const refused = makeDeps({
      parsePullRequestEdit: () => "edit is required",
    });
    expect(
      (
        await call(refused, "POST", "/api/prs/edit", {
          ownerRepo: "a/b",
          number: 2,
        })
      )?.body,
    ).toEqual({
      error: "edit is required",
    });
  });

  test("diff reads from the configured checkout", async () => {
    const deps = makeDeps();
    const answer = await call(
      deps,
      "GET",
      `/api/prs/diff?repo=acme/widgets&number=3&head=${sha}&base=${other}&whitespace=hide`,
    );
    expect(answer).toEqual({ status: 200, body: { source: "git" } });
    expect(deps.operations.readPullRequestDiff).toHaveBeenCalledWith({
      checkout: repo,
      transport,
      ref: { ownerRepo: "acme/widgets", number: 3 },
      head: sha,
      base: other,
      whitespace: "hide",
    });
  });

  test("diff refuses an unconfigured repository without reading anything", async () => {
    const deps = makeDeps();
    const answer = await call(
      deps,
      "GET",
      `/api/prs/diff?repo=acme/other&number=3&head=${sha}&base=${other}`,
    );
    expect(answer?.status).toBe(200);
    expect(answer?.body).toMatchObject({
      refused: { reason: "notConfigured", ownerRepo: "acme/other", configPath },
    });
    expect(deps.operations.readPullRequestDiff).not.toHaveBeenCalled();
  });

  test("reading order reads from the configured checkout", async () => {
    const deps = makeDeps();
    const answer = await call(
      deps,
      "GET",
      `/api/prs/reading-order?repo=acme/widgets&number=3&head=${sha}&base=${other}`,
    );
    expect(answer).toEqual({ status: 200, body: { groups: [] } });
    expect(deps.operations.readReadingOrder).toHaveBeenCalledWith({
      checkout: repo,
      head: sha,
      base: other,
    });
  });

  test("reading order refuses an unconfigured repository without reading anything", async () => {
    const deps = makeDeps();
    const answer = await call(
      deps,
      "GET",
      `/api/prs/reading-order?repo=acme/other&number=3&head=${sha}&base=${other}`,
    );
    expect(answer?.body).toMatchObject({
      refused: { reason: "notConfigured", ownerRepo: "acme/other", configPath },
    });
    expect(deps.operations.readReadingOrder).not.toHaveBeenCalled();
    expect(
      (
        await call(
          deps,
          "GET",
          "/api/prs/reading-order?repo=acme/widgets&number=3&head=x&base=y",
        )
      )?.status,
    ).toBe(400);
  });

  test("impacts reads from the configured checkout", async () => {
    const deps = makeDeps();
    const answer = await call(
      deps,
      "GET",
      `/api/prs/impacts?repo=acme/widgets&number=3&head=${sha}&base=${other}`,
    );
    expect(answer).toEqual({
      status: 200,
      body: { tooLarge: false, files: [], notAnalyzed: [], unresolvedIn: [] },
    });
    expect(deps.operations.readImpacts).toHaveBeenCalledWith({
      checkout: repo,
      head: sha,
      base: other,
    });
  });

  test("impacts refuses an unconfigured repository without reading anything", async () => {
    const deps = makeDeps();
    const answer = await call(
      deps,
      "GET",
      `/api/prs/impacts?repo=acme/other&number=3&head=${sha}&base=${other}`,
    );
    expect(answer?.body).toMatchObject({
      refused: { reason: "notConfigured", ownerRepo: "acme/other", configPath },
    });
    expect(deps.operations.readImpacts).not.toHaveBeenCalled();
    expect(
      (
        await call(
          deps,
          "GET",
          "/api/prs/impacts?repo=acme/widgets&number=3&head=x&base=y",
        )
      )?.status,
    ).toBe(400);
  });

  const readLines = async (answer: Awaited<ReturnType<typeof call>>) => {
    const lines: unknown[] = [];
    for await (const line of answer?.lines ?? []) lines.push(line);
    return lines;
  };

  test("diff stream=1 answers the steps, then the result", async () => {
    const deps = makeDeps({
      readPullRequestDiff: vi.fn(async ({ onStep }) => {
        onStep?.("fetching");
        onStep?.("diffing");
        return { source: "git" };
      }) as unknown as PullRequestOperations["readPullRequestDiff"],
    });
    const answer = await call(
      deps,
      "GET",
      `/api/prs/diff?repo=acme/widgets&number=3&head=${sha}&base=${other}&stream=1`,
    );
    expect(answer?.status).toBe(200);
    expect(await readLines(answer)).toEqual([
      { step: "fetching" },
      { step: "diffing" },
      { result: { source: "git" } },
    ]);
  });

  test("diff stream=1 ends with an error line when the read throws", async () => {
    const deps = makeDeps({
      readPullRequestDiff: vi.fn(async ({ onStep }) => {
        onStep?.("fetching");
        throw new Error("fetch refused");
      }) as unknown as PullRequestOperations["readPullRequestDiff"],
    });
    const answer = await call(
      deps,
      "GET",
      `/api/prs/diff?repo=acme/widgets&number=3&head=${sha}&base=${other}&stream=1`,
    );
    expect(await readLines(answer)).toEqual([
      { step: "fetching" },
      { error: "fetch refused" },
    ]);
  });

  test("diff stream=1 answers a refusal as its one line", async () => {
    const deps = makeDeps();
    const answer = await call(
      deps,
      "GET",
      `/api/prs/diff?repo=acme/other&number=3&head=${sha}&base=${other}&stream=1`,
    );
    const lines = await readLines(answer);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      refused: { reason: "notConfigured", ownerRepo: "acme/other" },
    });
    expect(deps.operations.readPullRequestDiff).not.toHaveBeenCalled();
  });

  test("diff validates shas and whitespace", async () => {
    const deps = makeDeps();
    expect(
      (
        await call(
          deps,
          "GET",
          `/api/prs/diff?repo=a/b&number=3&head=main&base=${other}`,
        )
      )?.status,
    ).toBe(400);
    expect(
      (
        await call(
          deps,
          "GET",
          `/api/prs/diff?repo=a/b&number=3&head=${sha}&base=${other}&whitespace=x`,
        )
      )?.status,
    ).toBe(400);
  });

  test("file reads at a sha, or is refused for an unconfigured repo", async () => {
    const deps = makeDeps();
    const answer = await call(
      deps,
      "GET",
      `/api/prs/file?repo=acme/widgets&number=3&sha=${sha}&path=src/a.ts`,
    );
    expect(answer).toEqual({ status: 200, body: { contents: "file body" } });
    expect(deps.operations.readFileAtSha).toHaveBeenCalledWith(
      repo,
      sha,
      "src/a.ts",
    );
    expect(
      (
        await call(
          deps,
          "GET",
          `/api/prs/file?repo=acme/other&number=3&sha=${sha}&path=a`,
        )
      )?.status,
    ).toBe(400);
    expect(
      (
        await call(
          deps,
          "GET",
          `/api/prs/file?repo=acme/widgets&number=3&sha=${sha}`,
        )
      )?.status,
    ).toBe(400);
  });

  describe("config file", () => {
    let home: string;
    let path: string;
    const deps = (): RouteDeps => ({ ...makeDeps(), configPath: path });
    const valid = JSON.stringify({ repos: { "acme/widgets": repo } }, null, 2);

    beforeEach(() => {
      home = mkdtempSync(join(tmpdir(), "reviewflow-app-config-file-"));
      path = join(home, "nested", "config.json");
    });
    afterEach(() => {
      rmSync(home, { recursive: true, force: true });
    });

    test("GET answers the path, and no file as an empty text", async () => {
      expect((await call(deps(), "GET", "/api/config/file"))?.body).toEqual({
        path,
        source: "",
        exists: false,
      });
    });

    test("PUT creates the file and answers it with its warnings", async () => {
      const source = JSON.stringify({
        repos: { "acme/widgets": repo, "acme/gone": join(home, "gone") },
      });
      const answer = await call(deps(), "PUT", "/api/config/file", {
        source,
        expectedSource: "",
      });
      expect(answer?.status).toBe(200);
      expect(answer?.body).toEqual({
        path,
        source: `${source}\n`,
        exists: true,
        warnings: [expect.stringContaining("acme/gone: ")],
      });
      expect(readFileSync(path, "utf8")).toBe(`${source}\n`);
      expect(
        (await call(deps(), "GET", "/api/config/file"))?.body,
      ).toMatchObject({ source: `${source}\n`, exists: true });
    });

    test("PUT refuses an invalid source with 400 and writes nothing", async () => {
      const answer = await call(deps(), "PUT", "/api/config/file", {
        source: '{"repos": []}',
        expectedSource: "",
      });
      expect(answer?.status).toBe(400);
      expect(answer?.body).toEqual({
        error: expect.stringContaining('"repos" must be an object'),
      });
      expect(existsSync(path)).toBe(false);
    });

    test("PUT answers 409 with the text on disk when the file changed", async () => {
      mkdirSync(join(home, "nested"));
      writeFileSync(path, valid);
      const answer = await call(deps(), "PUT", "/api/config/file", {
        source: '{"repos": {}}',
        expectedSource: "something else\n",
      });
      expect(answer).toEqual({
        status: 409,
        body: { conflict: { source: valid } },
      });
      expect(readFileSync(path, "utf8")).toBe(valid);
    });

    test("PUT refuses a body without both texts", async () => {
      expect((await call(deps(), "PUT", "/api/config/file", {}))?.status).toBe(
        400,
      );
      expect(
        (await call(deps(), "PUT", "/api/config/file", { source: "{}" }))
          ?.status,
      ).toBe(400);
    });

    test("other methods are refused", async () => {
      expect((await call(deps(), "POST", "/api/config/file"))?.status).toBe(
        405,
      );
    });
  });

  test("config/repo answers whether a checkout is attached", async () => {
    expect(
      (await call(makeDeps(), "GET", "/api/config/repo?repo=acme/widgets"))
        ?.body,
    ).toEqual({ ownerRepo: "acme/widgets", status: "attached", detail: repo });
    expect(
      (await call(makeDeps(), "GET", "/api/config/repo?repo=acme/other"))?.body,
    ).toMatchObject({ ownerRepo: "acme/other", status: "notConfigured" });
    expect(
      (await call(makeDeps(), "GET", "/api/config/repo?repo=nope"))?.status,
    ).toBe(400);
  });
});
