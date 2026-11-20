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
import type {
  CheckoutBranchesResponse,
  GitHubTransport,
} from "@reviewflow/sdk";
import type { ReviewflowService } from "./reviewflowService.ts";
import type { PullRequestOperations, RouteDeps } from "./routes.ts";
import { routeApiRequest } from "./routes.ts";

const sha = "a".repeat(40);
const other = "b".repeat(40);
const older = "c".repeat(40);
const transport = {} satisfies Partial<GitHubTransport> as GitHubTransport;

let root: string;
let repo: string;
let checkouts: string;
let discovered: string;
let configPath: string;

const initCheckout = (path: string, origin: string): void => {
  mkdirSync(path, { recursive: true });
  execFileSync("git", ["init", "--quiet"], { cwd: path });
  execFileSync("git", ["remote", "add", "origin", origin], { cwd: path });
};

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "reviewflow-app-routes-"));
  repo = join(root, "checkout");
  initCheckout(repo, "https://github.com/christophehurpeau/widgets.git");
  // the directory searched for checkouts the config does not name, never the user's own
  checkouts = join(root, "checkouts");
  discovered = join(checkouts, "gadgets");
  initCheckout(discovered, "git@github.com:christophehurpeau/gadgets.git");
  initCheckout(
    join(checkouts, "widgets-copy"),
    "https://github.com/christophehurpeau/widgets",
  );
  mkdirSync(join(checkouts, "notes"));
  configPath = join(root, "config.json");
  writeFileSync(
    configPath,
    JSON.stringify({
      repoPaths: [checkouts],
      repos: { "christophehurpeau/widgets": repo },
    }),
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
    readHeadBranch: vi.fn(async () => "feature"),
    readCheckoutBranchDiff: vi.fn(async () => ({ patch: "fake" })),
    readRecentCommits: vi.fn(async () => ({ commits: [] })),
    readCommitDiff: vi.fn(async () => ({ patch: "commit" })),
    readCheckoutSync: vi.fn(async () => ({ fetchError: null })),
    pullCheckout: vi.fn(async () => undefined),
    pushCheckout: vi.fn(async () => undefined),
    listWorktrees: vi.fn(async () => [
      { path: repo, prunable: false },
      { path: "/elsewhere/widgets-fix", prunable: false },
      { path: "/elsewhere/gone", prunable: true },
    ]),
    readWorktreeStatuses: vi.fn(async () => ({ statuses: [] })),
    readBranches: vi.fn(async () => ({ branches: [] })),
    fetchOpenPullRequests: vi.fn(async () => ({ pullRequests: [] })),
    fetchBranchPullRequests: vi.fn(async () => [
      { number: 7, state: "MERGED", sha: other, commitOids: [other] },
      { number: 3, state: "MERGED", sha: older, commitOids: [older] },
    ]),
    linkBranchPullRequests: vi.fn(async () => [
      { number: 7, state: "MERGED", sha: other },
    ]),
    readWorktreeRemovalStatus: vi.fn(async () => ({ main: false })),
    prepareWorktreeRemoval: vi.fn(async () => ({ path: "plan" })),
    completeWorktreeRemoval: vi.fn(async () => ({ branchError: null })),
    listCheckoutFiles: vi.fn(async () => ({
      paths: ["a.ts", "src/b.ts"],
      statuses: { "a.ts": "modified" },
    })),
    readCheckoutFile: vi.fn(() => ({ status: "text", source: "a" })),
    readCheckoutFileAtHead: vi.fn(async () => ({
      status: "text",
      source: "committed",
    })),
    saveCheckoutFile: vi.fn(async () => ({
      status: "saved",
      source: "b",
      warnings: [],
    })),
    cloneRepository: vi.fn(async () => undefined),
    watchCheckout: vi.fn(async () => () => undefined),
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

describe("repos", () => {
  test("lists the configured checkouts and the ones found under repoPaths", async () => {
    const deps = makeDeps();
    expect(await call(deps, "GET", "/api/repos?refresh=1")).toEqual({
      status: 200,
      body: {
        configPath,
        repoPaths: [checkouts],
        scannedAt: expect.any(String),
        repos: [
          {
            ownerRepo: "christophehurpeau/gadgets",
            path: discovered,
            configured: false,
            branch: "feature",
            problem: null,
          },
          {
            ownerRepo: "christophehurpeau/widgets",
            path: repo,
            configured: true,
            branch: "feature",
            problem: null,
          },
        ],
      },
    });
    expect(deps.operations.readHeadBranch).toHaveBeenCalledWith(repo);
  });

  test("diffs a discovered checkout, and refuses a repository it does not list", async () => {
    const deps = makeDeps();
    await call(deps, "GET", "/api/repos/diff?repo=CHRISTOPHEHURPEAU/gadgets");
    expect(deps.operations.readCheckoutBranchDiff).toHaveBeenCalledWith({
      checkout: discovered,
      scope: "committed",
      whitespace: "show",
    });
    expect(
      (await call(deps, "GET", "/api/repos/diff?repo=christophehurpeau/other"))
        ?.status,
    ).toBe(400);
  });

  test("reads a listed checkout's status, fetching only when asked", async () => {
    const deps = makeDeps();
    await call(deps, "GET", "/api/repos/status?repo=christophehurpeau/widgets");
    await call(
      deps,
      "GET",
      "/api/repos/status?repo=christophehurpeau/widgets&fetch=1",
    );
    expect(deps.operations.readCheckoutSync).toHaveBeenNthCalledWith(1, {
      checkout: repo,
      fetch: "never",
    });
    expect(deps.operations.readCheckoutSync).toHaveBeenNthCalledWith(2, {
      checkout: repo,
      fetch: "always",
    });
  });

  test("pulls and pushes a listed checkout on a POST, git's refusal as a 400", async () => {
    const deps = makeDeps({
      pushCheckout: vi.fn(async () => {
        throw new Error("widgets has nothing to push");
      }),
    });
    expect(
      await call(
        deps,
        "POST",
        "/api/repos/pull?repo=christophehurpeau/widgets",
      ),
    ).toEqual({ status: 200, body: { path: repo } });
    expect(deps.operations.pullCheckout).toHaveBeenCalledWith(repo);
    expect(
      await call(
        deps,
        "POST",
        "/api/repos/push?repo=christophehurpeau/widgets",
      ),
    ).toEqual({ status: 400, body: { error: "widgets has nothing to push" } });
    expect(
      (
        await call(
          deps,
          "GET",
          "/api/repos/pull?repo=christophehurpeau/widgets",
        )
      )?.status,
    ).toBe(405);
    expect(
      (await call(deps, "POST", "/api/repos/pull?repo=christophehurpeau/other"))
        ?.status,
    ).toBe(400);
  });

  test("reads the recent commits and one commit's diff of a listed checkout", async () => {
    const deps = makeDeps();
    expect(
      await call(
        deps,
        "GET",
        "/api/repos/commits?repo=christophehurpeau/widgets&limit=5",
      ),
    ).toEqual({ status: 200, body: { commits: [] } });
    expect(deps.operations.readRecentCommits).toHaveBeenCalledWith({
      checkout: repo,
      limit: 5,
    });
    expect(
      await call(
        deps,
        "GET",
        `/api/repos/commit?repo=christophehurpeau/widgets&sha=${sha}&whitespace=hide`,
      ),
    ).toEqual({ status: 200, body: { patch: "commit" } });
    expect(deps.operations.readCommitDiff).toHaveBeenCalledWith({
      checkout: repo,
      sha,
      whitespace: "hide",
    });
    expect(
      (
        await call(
          deps,
          "GET",
          "/api/repos/commits?repo=christophehurpeau/widgets&limit=0",
        )
      )?.status,
    ).toBe(400);
    expect(
      (
        await call(
          deps,
          "GET",
          "/api/repos/commit?repo=christophehurpeau/widgets&sha=nope",
        )
      )?.status,
    ).toBe(400);
  });

  test("reads a local branch in place of HEAD when asked, refusing an empty name", async () => {
    const deps = makeDeps();
    await call(
      deps,
      "GET",
      "/api/repos/diff?repo=christophehurpeau/widgets&branch=feat/x",
    );
    expect(deps.operations.readCheckoutBranchDiff).toHaveBeenCalledWith({
      checkout: repo,
      scope: "committed",
      whitespace: "show",
      branch: "feat/x",
    });
    await call(
      deps,
      "GET",
      "/api/repos/commits?repo=christophehurpeau/widgets&branch=feat/x",
    );
    expect(deps.operations.readRecentCommits).toHaveBeenCalledWith({
      checkout: repo,
      limit: 30,
      branch: "feat/x",
    });
    expect(
      (
        await call(
          deps,
          "GET",
          "/api/repos/commits?repo=christophehurpeau/widgets&branch=",
        )
      )?.status,
    ).toBe(400);
  });

  test("diffs the configured checkout, never a path from the request", async () => {
    const deps = makeDeps();
    const answer = await call(
      deps,
      "GET",
      "/api/repos/diff?repo=christophehurpeau/widgets&scope=uncommitted&whitespace=hide",
    );
    expect(answer).toEqual({ status: 200, body: { patch: "fake" } });
    expect(deps.operations.readCheckoutBranchDiff).toHaveBeenCalledWith({
      checkout: repo,
      scope: "uncommitted",
      whitespace: "hide",
    });
  });

  test("reads a worktree of a listed checkout, only one git lists", async () => {
    const deps = makeDeps();
    await call(
      deps,
      "GET",
      "/api/repos/status?repo=christophehurpeau/widgets&worktree=/elsewhere/widgets-fix",
    );
    expect(deps.operations.readCheckoutSync).toHaveBeenCalledWith({
      checkout: "/elsewhere/widgets-fix",
      fetch: "never",
    });
    expect(
      (
        await call(
          deps,
          "GET",
          "/api/repos/status?repo=christophehurpeau/widgets&worktree=/etc",
        )
      )?.status,
    ).toBe(400);
    expect(
      (
        await call(
          deps,
          "GET",
          "/api/repos/diff?repo=christophehurpeau/widgets&worktree=/elsewhere/gone",
        )
      )?.status,
    ).toBe(400);
  });

  test("reads the branches of a listed checkout and the open pull requests of a repository", async () => {
    const deps = makeDeps();
    expect(
      await call(
        deps,
        "GET",
        "/api/repos/branches?repo=christophehurpeau/widgets",
      ),
    ).toEqual({ status: 200, body: { branches: [] } });
    expect(deps.operations.readBranches).toHaveBeenCalledWith(repo);
    expect(
      await call(
        deps,
        "GET",
        "/api/repos/worktree-statuses?repo=christophehurpeau/widgets",
      ),
    ).toEqual({ status: 200, body: { statuses: [] } });
    expect(deps.operations.readWorktreeStatuses).toHaveBeenCalledWith(repo);
    const watch = await call(
      deps,
      "GET",
      "/api/repos/watch?repo=christophehurpeau/widgets&worktree=/elsewhere/widgets-fix",
    );
    expect(watch?.status).toBe(200);
    const stopWatch = watch?.events?.(() => undefined);
    expect(deps.operations.watchCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        mainCheckout: repo,
        checkout: "/elsewhere/widgets-fix",
      }),
    );
    stopWatch?.();
    expect(
      (
        await call(
          deps,
          "GET",
          "/api/repos/watch?repo=christophehurpeau/widgets&worktree=/nope",
        )
      )?.status,
    ).toBe(400);
    expect(
      await call(
        deps,
        "GET",
        "/api/repos/pulls?repo=christophehurpeau/widgets",
      ),
    ).toEqual({ status: 200, body: { pullRequests: [] } });
    expect(deps.operations.fetchOpenPullRequests).toHaveBeenCalledWith(
      transport,
      "christophehurpeau/widgets",
    );
    expect(
      (await call(deps, "GET", "/api/repos/pulls?repo=nope"))?.status,
    ).toBe(400);
  });

  test("reads a local branch's own pull requests, refusing a missing branch", async () => {
    const deps = makeDeps();
    expect(
      await call(
        deps,
        "GET",
        "/api/repos/branch-pulls?repo=christophehurpeau/widgets&branch=feat/x",
      ),
    ).toEqual({
      status: 200,
      body: { pullRequests: [{ number: 7, state: "MERGED", sha: other }] },
    });
    expect(deps.operations.fetchBranchPullRequests).toHaveBeenCalledWith(
      transport,
      "christophehurpeau/widgets",
      "feat/x",
    );
    expect(deps.operations.linkBranchPullRequests).toHaveBeenCalledWith({
      checkout: repo,
      branch: "feat/x",
      pullRequests: [
        { number: 7, state: "MERGED", sha: other, commitOids: [other] },
        { number: 3, state: "MERGED", sha: older, commitOids: [older] },
      ],
    });
    expect(
      (
        await call(
          deps,
          "GET",
          "/api/repos/branch-pulls?repo=christophehurpeau/widgets",
        )
      )?.status,
    ).toBe(400);
    expect(
      (await call(deps, "GET", "/api/repos/branch-pulls?repo=nope&branch=x"))
        ?.status,
    ).toBe(400);
  });

  describe("settled pull requests", () => {
    const merged = {
      found: true,
      pr: {
        number: 7,
        title: "Merged",
        headSha: other,
        baseRef: "main",
        state: "merged",
        author: "alice",
        updatedAt: "2026-11-01T10:00:00.000Z",
        closedAt: "2026-11-01T09:00:00.000Z",
      },
    };
    const reused = {
      found: true,
      pr: { ...merged.pr, number: 3, headSha: older, state: "closed" },
    };
    const open = {
      found: true,
      pr: { ...merged.pr, number: 9, state: "open" },
    };

    const withReviewflow = (
      lookup: ReviewflowService["lookup"],
    ): RouteDeps => ({
      ...makeDeps({
        readBranches: vi.fn(
          async () =>
            ({
              base: { name: "main" },
              branches: [
                { name: "feat/merged", sha: "a1" },
                { name: "feat/reused", sha: "b2" },
                { name: "feat/open", sha: "c3" },
                { name: "feat/none", sha: "d4" },
              ],
            }) as unknown as CheckoutBranchesResponse,
        ),
        linkBranchPullRequests: vi.fn<
          PullRequestOperations["linkBranchPullRequests"]
        >(async ({ branch, pullRequests }) =>
          branch === "feat/reused"
            ? []
            : pullRequests.map(({ commitOids: _, ...pr }) => pr),
        ),
      }),
      // oxlint-disable-next-line typescript/consistent-type-assertions
      reviewflow: { lookup } as ReviewflowService,
    });

    test("names the merged or closed pull request reviewflow records for each local branch, proven the branch's", async () => {
      const lookup = vi.fn(async () => [
        merged,
        reused,
        open,
        { found: false, reason: "noPr" },
      ]) as unknown as ReviewflowService["lookup"];
      const deps = withReviewflow(lookup);

      const answer = await call(
        deps,
        "GET",
        "/api/repos/settled-pulls?repo=christophehurpeau/widgets",
      );

      expect(lookup).toHaveBeenCalledWith([
        { ownerRepo: "christophehurpeau/widgets", headRef: "feat/merged" },
        { ownerRepo: "christophehurpeau/widgets", headRef: "feat/reused" },
        { ownerRepo: "christophehurpeau/widgets", headRef: "feat/open" },
        { ownerRepo: "christophehurpeau/widgets", headRef: "feat/none" },
      ]);
      expect(deps.operations.linkBranchPullRequests).toHaveBeenCalledTimes(2);
      expect(deps.operations.linkBranchPullRequests).toHaveBeenCalledWith(
        expect.objectContaining({
          branch: "feat/merged",
          tip: "a1",
          defaultBranch: "main",
        }),
      );
      expect(answer).toEqual({
        status: 200,
        body: {
          connected: true,
          branches: [
            {
              branch: "feat/merged",
              pullRequest: {
                number: 7,
                title: "Merged",
                state: "MERGED",
                isDraft: false,
                sha: other,
                baseRefName: "main",
                author: "alice",
                updatedAt: "2026-11-01T10:00:00.000Z",
                mergedAt: "2026-11-01T09:00:00.000Z",
                closedAt: "2026-11-01T09:00:00.000Z",
              },
            },
          ],
        },
      });
    });

    test("asks nothing without a reviewflow token", async () => {
      const deps = withReviewflow(vi.fn(async () => null));
      expect(
        await call(
          deps,
          "GET",
          "/api/repos/settled-pulls?repo=christophehurpeau/widgets",
        ),
      ).toEqual({ status: 200, body: { connected: false, branches: [] } });
      expect(deps.operations.linkBranchPullRequests).not.toHaveBeenCalled();
    });
  });

  test("reads what removing a worktree would lose, every head kept, only the branch's own listed", async () => {
    const deps = makeDeps();
    expect(
      await call(
        deps,
        "GET",
        "/api/repos/worktree-status?repo=christophehurpeau/widgets&worktree=/elsewhere/widgets-fix",
      ),
    ).toEqual({
      status: 200,
      body: {
        status: { main: false },
        pullRequests: [{ number: 7, state: "MERGED", sha: other }],
        pullRequestsError: null,
      },
    });
    expect(deps.operations.readWorktreeRemovalStatus).toHaveBeenCalledWith({
      worktree: "/elsewhere/widgets-fix",
      keptShas: [other, older],
    });
    expect(deps.operations.linkBranchPullRequests).toHaveBeenCalledWith(
      expect.objectContaining({
        checkout: "/elsewhere/widgets-fix",
        branch: "feature",
      }),
    );
  });

  test("keeps no head when GitHub fails, which errs toward refusing", async () => {
    const deps = makeDeps({
      fetchBranchPullRequests: vi.fn(async () => {
        throw new Error("offline");
      }),
    });
    const answer = await call(
      deps,
      "GET",
      "/api/repos/worktree-status?repo=christophehurpeau/widgets&worktree=/elsewhere/widgets-fix",
    );
    expect(answer?.body).toMatchObject({ pullRequestsError: "offline" });
    expect(deps.operations.readWorktreeRemovalStatus).toHaveBeenCalledWith({
      worktree: "/elsewhere/widgets-fix",
      keptShas: [],
    });
  });

  test("removes only a named worktree git lists, on a POST, its refusal as a 400", async () => {
    const deps = makeDeps();
    expect(
      await call(
        deps,
        "POST",
        "/api/repos/worktree-remove?repo=christophehurpeau/widgets&worktree=/elsewhere/widgets-fix",
        { deleteBranch: true },
      ),
    ).toEqual({ status: 200, body: { branchError: null } });
    expect(deps.operations.prepareWorktreeRemoval).toHaveBeenCalledWith({
      worktree: "/elsewhere/widgets-fix",
      keptShas: [other, older],
      deleteBranch: true,
    });
    expect(deps.operations.completeWorktreeRemoval).toHaveBeenCalledWith({
      path: "plan",
    });

    expect(
      (
        await call(
          deps,
          "POST",
          "/api/repos/worktree-remove?repo=christophehurpeau/widgets",
        )
      )?.status,
    ).toBe(400);
    expect(
      (
        await call(
          deps,
          "POST",
          "/api/repos/worktree-remove?repo=christophehurpeau/widgets&worktree=/etc",
        )
      )?.status,
    ).toBe(400);
    expect(
      (
        await call(
          deps,
          "GET",
          "/api/repos/worktree-remove?repo=christophehurpeau/widgets&worktree=/elsewhere/widgets-fix",
        )
      )?.status,
    ).toBe(405);

    const refusing = makeDeps({
      prepareWorktreeRemoval: vi.fn(async () => {
        throw new Error("1 untracked file: git would refuse");
      }),
    });
    expect(
      await call(
        refusing,
        "POST",
        "/api/repos/worktree-remove?repo=christophehurpeau/widgets&worktree=/elsewhere/widgets-fix",
        {},
      ),
    ).toEqual({
      status: 400,
      body: { error: "1 untracked file: git would refuse" },
    });
    expect(refusing.operations.completeWorktreeRemoval).not.toHaveBeenCalled();
  });

  test("clones into a configured folder on a POST, then lists the folders again", async () => {
    const deps = makeDeps();
    expect(
      await call(deps, "POST", "/api/repos/clone", {
        ownerRepo: "christophehurpeau/tools",
        folder: checkouts,
      }),
    ).toEqual({
      status: 200,
      body: {
        ownerRepo: "christophehurpeau/tools",
        path: join(checkouts, "tools"),
      },
    });
    expect(deps.operations.cloneRepository).toHaveBeenCalledWith({
      ownerRepo: "christophehurpeau/tools",
      target: join(checkouts, "tools"),
    });
    expect((await call(deps, "GET", "/api/repos/clone"))?.status).toBe(405);
  });

  test("refuses a clone outside repoPaths or over a directory, and answers gh's failure as a 400", async () => {
    const deps = makeDeps();
    expect(
      (
        await call(deps, "POST", "/api/repos/clone", {
          ownerRepo: "christophehurpeau/tools",
          folder: root,
        })
      )?.status,
    ).toBe(400);
    expect(
      (
        await call(deps, "POST", "/api/repos/clone", {
          ownerRepo: "christophehurpeau/gadgets",
          folder: checkouts,
        })
      )?.status,
    ).toBe(400);
    expect(deps.operations.cloneRepository).not.toHaveBeenCalled();

    const failing = makeDeps({
      cloneRepository: vi.fn(async () => {
        throw new Error(
          "gh repo clone christophehurpeau/tools failed: not found",
        );
      }),
    });
    expect(
      await call(failing, "POST", "/api/repos/clone", {
        ownerRepo: "christophehurpeau/tools",
        folder: checkouts,
      }),
    ).toEqual({
      status: 400,
      body: {
        error: "gh repo clone christophehurpeau/tools failed: not found",
      },
    });
  });

  test("refuses a bad scope or whitespace, and answers git's failure as a 400", async () => {
    const deps = makeDeps({
      readCheckoutBranchDiff: vi.fn(async () => {
        throw new Error("neither origin/main nor main exists");
      }),
    });
    expect(
      (
        await call(
          deps,
          "GET",
          "/api/repos/diff?repo=christophehurpeau/widgets&scope=x",
        )
      )?.status,
    ).toBe(400);
    expect(
      (
        await call(
          deps,
          "GET",
          "/api/repos/diff?repo=christophehurpeau/widgets&whitespace=x",
        )
      )?.status,
    ).toBe(400);
    expect(
      await call(deps, "GET", "/api/repos/diff?repo=christophehurpeau/widgets"),
    ).toEqual({
      status: 400,
      body: { error: "neither origin/main nor main exists" },
    });
  });
});

describe("checkout files", () => {
  test("lists a worktree's files, and reads one within its main checkout's bounds", async () => {
    const deps = makeDeps();
    const worktree = "/elsewhere/widgets-fix";

    expect(
      await call(
        deps,
        "GET",
        `/api/repos/files?repo=christophehurpeau/widgets&worktree=${worktree}`,
      ),
    ).toEqual({
      status: 200,
      body: {
        paths: ["a.ts", "src/b.ts"],
        statuses: { "a.ts": "modified" },
      },
    });
    expect(deps.operations.listCheckoutFiles).toHaveBeenCalledWith(worktree);

    expect(
      await call(
        deps,
        "GET",
        `/api/repos/file?repo=christophehurpeau/widgets&worktree=${worktree}&path=a.ts`,
      ),
    ).toEqual({ status: 200, body: { status: "text", source: "a" } });
    expect(deps.operations.readCheckoutFile).toHaveBeenCalledWith(
      { checkout: worktree, mainCheckout: repo },
      "a.ts",
    );
  });

  test("answers a refused path as a 400", async () => {
    const deps = makeDeps({
      readCheckoutFile: vi.fn(() => ({ refused: "x is inside .git" })),
    });
    expect(
      await call(
        deps,
        "GET",
        "/api/repos/file?repo=christophehurpeau/widgets&path=x",
      ),
    ).toEqual({ status: 400, body: { error: "x is inside .git" } });
  });

  test("reads the file as HEAD has it with at=head", async () => {
    const deps = makeDeps();
    expect(
      await call(
        deps,
        "GET",
        "/api/repos/file?repo=christophehurpeau/widgets&path=a.ts&at=head",
      ),
    ).toEqual({ status: 200, body: { status: "text", source: "committed" } });
    expect(deps.operations.readCheckoutFileAtHead).toHaveBeenCalledWith(
      repo,
      "a.ts",
    );
    expect(deps.operations.readCheckoutFile).not.toHaveBeenCalled();
  });

  test("saves on a PUT, and refuses a body without the opened text", async () => {
    const deps = makeDeps();
    expect(
      await call(
        deps,
        "PUT",
        "/api/repos/file?repo=christophehurpeau/widgets",
        {
          path: "a.ts",
          source: "b",
          expectedSource: "a",
        },
      ),
    ).toEqual({
      status: 200,
      body: { status: "saved", source: "b", warnings: [] },
    });
    expect(deps.operations.saveCheckoutFile).toHaveBeenCalledWith(
      { checkout: repo, mainCheckout: repo },
      { path: "a.ts", source: "b", expectedSource: "a" },
    );
    expect(
      (
        await call(
          deps,
          "PUT",
          "/api/repos/file?repo=christophehurpeau/widgets",
          {
            path: "a.ts",
            source: "b",
          },
        )
      )?.status,
    ).toBe(400);
  });
});

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
      "/api/prs/detail?repo=christophehurpeau/widgets&number=3&part=checks",
    );
    expect(answer).toEqual({ status: 200, body: { part: "fake" } });
    expect(deps.operations.fetchPullRequestPart).toHaveBeenCalledWith(
      transport,
      { ownerRepo: "christophehurpeau/widgets", number: 3 },
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
      `/api/prs/diff?repo=christophehurpeau/widgets&number=3&head=${sha}&base=${other}&whitespace=hide`,
    );
    expect(answer).toEqual({ status: 200, body: { source: "git" } });
    expect(deps.operations.readPullRequestDiff).toHaveBeenCalledWith({
      checkout: repo,
      transport,
      ref: { ownerRepo: "christophehurpeau/widgets", number: 3 },
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
      `/api/prs/diff?repo=christophehurpeau/other&number=3&head=${sha}&base=${other}`,
    );
    expect(answer?.status).toBe(200);
    expect(answer?.body).toMatchObject({
      refused: {
        reason: "notConfigured",
        ownerRepo: "christophehurpeau/other",
        configPath,
      },
    });
    expect(deps.operations.readPullRequestDiff).not.toHaveBeenCalled();
  });

  test("reading order reads from the configured checkout", async () => {
    const deps = makeDeps();
    const answer = await call(
      deps,
      "GET",
      `/api/prs/reading-order?repo=christophehurpeau/widgets&number=3&head=${sha}&base=${other}`,
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
      `/api/prs/reading-order?repo=christophehurpeau/other&number=3&head=${sha}&base=${other}`,
    );
    expect(answer?.body).toMatchObject({
      refused: {
        reason: "notConfigured",
        ownerRepo: "christophehurpeau/other",
        configPath,
      },
    });
    expect(deps.operations.readReadingOrder).not.toHaveBeenCalled();
    expect(
      (
        await call(
          deps,
          "GET",
          "/api/prs/reading-order?repo=christophehurpeau/widgets&number=3&head=x&base=y",
        )
      )?.status,
    ).toBe(400);
  });

  test("impacts reads from the configured checkout", async () => {
    const deps = makeDeps();
    const answer = await call(
      deps,
      "GET",
      `/api/prs/impacts?repo=christophehurpeau/widgets&number=3&head=${sha}&base=${other}`,
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
      `/api/prs/impacts?repo=christophehurpeau/other&number=3&head=${sha}&base=${other}`,
    );
    expect(answer?.body).toMatchObject({
      refused: {
        reason: "notConfigured",
        ownerRepo: "christophehurpeau/other",
        configPath,
      },
    });
    expect(deps.operations.readImpacts).not.toHaveBeenCalled();
    expect(
      (
        await call(
          deps,
          "GET",
          "/api/prs/impacts?repo=christophehurpeau/widgets&number=3&head=x&base=y",
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
      `/api/prs/diff?repo=christophehurpeau/widgets&number=3&head=${sha}&base=${other}&stream=1`,
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
      `/api/prs/diff?repo=christophehurpeau/widgets&number=3&head=${sha}&base=${other}&stream=1`,
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
      `/api/prs/diff?repo=christophehurpeau/other&number=3&head=${sha}&base=${other}&stream=1`,
    );
    const lines = await readLines(answer);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      refused: {
        reason: "notConfigured",
        ownerRepo: "christophehurpeau/other",
      },
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
      `/api/prs/file?repo=christophehurpeau/widgets&number=3&sha=${sha}&path=src/a.ts`,
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
          `/api/prs/file?repo=christophehurpeau/other&number=3&sha=${sha}&path=a`,
        )
      )?.status,
    ).toBe(400);
    expect(
      (
        await call(
          deps,
          "GET",
          `/api/prs/file?repo=christophehurpeau/widgets&number=3&sha=${sha}`,
        )
      )?.status,
    ).toBe(400);
  });

  describe("config file", () => {
    let home: string;
    let path: string;
    const deps = (): RouteDeps => ({ ...makeDeps(), configPath: path });
    const valid = JSON.stringify(
      { repos: { "christophehurpeau/widgets": repo } },
      null,
      2,
    );

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
        repos: {
          "christophehurpeau/widgets": repo,
          "christophehurpeau/gone": join(home, "gone"),
        },
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
        warnings: [expect.stringContaining("christophehurpeau/gone: ")],
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
      (
        await call(
          makeDeps(),
          "GET",
          "/api/config/repo?repo=christophehurpeau/widgets",
        )
      )?.body,
    ).toEqual({
      ownerRepo: "christophehurpeau/widgets",
      status: "attached",
      detail: repo,
    });
    expect(
      (
        await call(
          makeDeps(),
          "GET",
          "/api/config/repo?repo=christophehurpeau/other",
        )
      )?.body,
    ).toMatchObject({
      ownerRepo: "christophehurpeau/other",
      status: "notConfigured",
    });
    expect(
      (await call(makeDeps(), "GET", "/api/config/repo?repo=nope"))?.status,
    ).toBe(400);
  });

  test("config/repo-paths/suggestions is read only", async () => {
    expect(
      (await call(makeDeps(), "POST", "/api/config/repo-paths/suggestions"))
        ?.status,
    ).toBe(405);
  });
});
