import { describe, expect, it } from "vitest";
import type { PrQuery, PrQueryData, PrQueryTarget } from "./prQuery.ts";
import { buildPrQuery, parsePrQueryResponse, prsPerBranch } from "./prQuery.ts";

const target = (overrides: Partial<PrQueryTarget> = {}): PrQueryTarget => ({
  branchId: "branch-1",
  taskId: "task-1",
  ownerRepo: "owner/repo",
  branch: "feature/one",
  ...overrides,
});

interface CountByState {
  count: number;
  state: string;
}

const pullRequest = ({
  number = 7,
  title = "feat: add the thing",
  state = "OPEN",
  isDraft = false,
  reviewDecision = null,
  pendingReviewRequests = 0,
  mergedAt = null,
  closedAt = null,
  mergeable = "UNKNOWN",
  headRefOid = "0123456789abcdef0123456789abcdef01234567",
  baseRefName = "main",
  checkRuns = [],
  statusContexts = [],
  rollup = true,
}: {
  number?: number;
  title?: string;
  state?: string;
  isDraft?: boolean;
  reviewDecision?: string | null;
  pendingReviewRequests?: number;
  mergedAt?: string | null;
  closedAt?: string | null;
  mergeable?: string;
  headRefOid?: string;
  baseRefName?: string;
  checkRuns?: CountByState[];
  statusContexts?: CountByState[];
  rollup?: boolean;
} = {}): unknown => ({
  number,
  title,
  state,
  isDraft,
  reviewDecision,
  reviewRequests: { totalCount: pendingReviewRequests },
  mergedAt,
  closedAt,
  mergeable,
  headRefOid,
  baseRefName,
  commits: {
    nodes: [
      {
        commit: {
          statusCheckRollup: rollup
            ? {
                contexts: {
                  checkRunCountsByState: checkRuns,
                  statusContextCountsByState: statusContexts,
                },
              }
            : null,
        },
      },
    ],
  },
});

const data = (repositories: Record<string, unknown>): PrQueryData =>
  repositories as PrQueryData;

/** Every caller here has queryable targets; null would be the test's own bug. */
const build = (targets: PrQueryTarget[]): PrQuery => {
  const built = buildPrQuery(targets);
  if (built === null) throw new Error("expected a query to be built");
  return built;
};

/** The aliases are the builder's to choose, so a test reads rather than names one. */
const firstAlias = (targetsByAlias: Map<string, PrQueryTarget>): string => {
  const [alias] = [...targetsByAlias.keys()];
  if (alias === undefined) throw new Error("expected at least one alias");
  return alias;
};

describe("buildPrQuery", () => {
  it("puts every branch of every repo in one document", () => {
    const { query, targetsByAlias } = build([
      target(),
      target({ branchId: "branch-2", taskId: "task-2", branch: "feature/two" }),
      target({
        branchId: "branch-3",
        taskId: "task-3",
        ownerRepo: "owner/other",
        branch: "feature/three",
      }),
    ]);

    // Two repository blocks, three branch fields, one document.
    expect(query.match(/repository\(/g)).toHaveLength(2);
    expect(query.match(/pullRequests\(/g)).toHaveLength(3);
    expect(/^query \{$/mu.exec(query)).not.toBeNull();
    expect(targetsByAlias.size).toBe(3);
  });

  /**
   * The rate limit charges every nested connection once per node of its
   * parent, so only the branch's own connection reads several pull requests:
   * everything inside one pull request asks for a single node.
   */
  it("asks a branch for a bounded number of pull requests, and one node of anything inside them", () => {
    const { query } = build([target(), target({ branch: "feature/two" })]);
    const branchConnection = new RegExp(
      `pullRequests\\(headRefName: [^,]+, first: ${String(prsPerBranch)},`,
      "gu",
    );

    expect(query.match(branchConnection)).toHaveLength(2);
    expect(query.replace(branchConnection, "")).not.toMatch(
      /first:\s*(?!1\b)\d+/u,
    );
    expect(query).not.toMatch(/last:\s*(?!1\b)\d+/u);
  });

  it("escapes a branch name rather than interpolating it", () => {
    const { query } = build([target({ branch: 'we"ird\\branch' })]);

    expect(query).toContain(String.raw`headRefName: "we\"ird\\branch"`);
  });

  it("skips a target whose ownerRepo is not owner/repo", () => {
    expect(buildPrQuery([target({ ownerRepo: "not-a-slug" })])).toBeNull();
    expect(buildPrQuery([target({ ownerRepo: "a/b/c" })])).toBeNull();
    expect(buildPrQuery([target({ ownerRepo: "owner/" })])).toBeNull();
  });

  it("returns null when there is nothing to ask about", () => {
    expect(buildPrQuery([])).toBeNull();
    expect(buildPrQuery([target({ branch: "" })])).toBeNull();
  });
});

describe("parsePrQueryResponse", () => {
  const parseOne = (node: unknown): ReturnType<typeof parsePrQueryResponse> => {
    const { targetsByAlias } = build([target()]);
    return parsePrQueryResponse(
      data({ r0: { [firstAlias(targetsByAlias)]: { nodes: [node] } } }),
      targetsByAlias,
    );
  };

  it("folds isDraft into the state, which the schema has no column for", () => {
    expect(
      parseOne(pullRequest({ state: "OPEN", isDraft: true }))[0]?.state,
    ).toBe("draft");
    expect(parseOne(pullRequest({ state: "OPEN" }))[0]?.state).toBe("open");
    expect(parseOne(pullRequest({ state: "CLOSED" }))[0]?.state).toBe("closed");
    expect(parseOne(pullRequest({ state: "MERGED" }))[0]?.state).toBe("merged");
  });

  it("ignores a state it does not know rather than guessing one", () => {
    expect(parseOne(pullRequest({ state: "SOMETHING_NEW" }))).toEqual([]);
  });

  it("maps the review decision, and null when there is none", () => {
    expect(
      parseOne(pullRequest({ reviewDecision: "CHANGES_REQUESTED" }))[0]
        ?.reviewDecision,
    ).toBe("changesRequested");
    expect(parseOne(pullRequest())[0]?.reviewDecision).toBeNull();
    expect(
      parseOne(pullRequest({ reviewDecision: "BRAND_NEW" }))[0]?.reviewDecision,
    ).toBeNull();
  });

  it("reads a pending review request as a review still required, as reviewflow does", () => {
    const decisionOf = (
      reviewDecision: string | null,
    ): string | null | undefined =>
      parseOne(pullRequest({ reviewDecision, pendingReviewRequests: 2 }))[0]
        ?.reviewDecision;

    expect(decisionOf("APPROVED")).toBe("reviewRequired");
    expect(decisionOf(null)).toBe("reviewRequired");
    expect(decisionOf("CHANGES_REQUESTED")).toBe("changesRequested");
  });

  it("sums the rollup aggregates over check runs and status contexts", () => {
    const [found] = parseOne(
      pullRequest({
        checkRuns: [
          { count: 9, state: "SUCCESS" },
          { count: 2, state: "FAILURE" },
          { count: 1, state: "IN_PROGRESS" },
          { count: 3, state: "SKIPPED" },
        ],
        statusContexts: [
          { count: 1, state: "ERROR" },
          { count: 4, state: "SUCCESS" },
        ],
      }),
    );

    expect(found).toMatchObject({
      checksPassed: 16,
      checksFailed: 3,
      checksPending: 1,
    });
  });

  /**
   * A superseded run is not a red build: counting it as failing would raise
   * `checksFailing` on a PR nobody needs to look at, which is how an attention
   * signal stops being read.
   */
  it("counts a cancelled or stale check as pending, never as failing", () => {
    const [found] = parseOne(
      pullRequest({
        checkRuns: [
          { count: 2, state: "CANCELLED" },
          { count: 1, state: "STALE" },
        ],
      }),
    );

    expect(found).toMatchObject({
      checksPassed: 0,
      checksFailed: 0,
      checksPending: 3,
    });
  });

  /** What the delete-worktree guard proves a pruned branch's commits are on GitHub with. */
  it("keeps the head commit", () => {
    expect(parseOne(pullRequest({ headRefOid: "feedface" }))[0]?.headSha).toBe(
      "feedface",
    );
  });

  it("maps whether the pull request merges, unknown for anything else", () => {
    expect(
      parseOne(pullRequest({ mergeable: "CONFLICTING" }))[0]?.mergeable,
    ).toBe("conflicting");
    expect(
      parseOne(pullRequest({ mergeable: "MERGEABLE" }))[0]?.mergeable,
    ).toBe("mergeable");
    expect(parseOne(pullRequest({ mergeable: "UNKNOWN" }))[0]?.mergeable).toBe(
      "unknown",
    );
  });

  it("keeps the title", () => {
    expect(
      parseOne(pullRequest({ title: "fix: the thing GEN-1234" }))[0]?.title,
    ).toBe("fix: the thing GEN-1234");
  });

  /** What the branch diff is taken against when it is not the repo's default. */
  it("keeps the base branch", () => {
    expect(parseOne(pullRequest({ baseRefName: "develop" }))[0]?.baseRef).toBe(
      "develop",
    );
  });

  it("reads a pull request with no rollup at all as no checks", () => {
    expect(parseOne(pullRequest({ rollup: false }))[0]).toMatchObject({
      checksPassed: 0,
      checksFailed: 0,
      checksPending: 0,
    });
  });

  /**
   * A branch with no PR is the normal state of a worktree whose work has not
   * been pushed for review, not an absence to record.
   */
  it("produces nothing for a branch GitHub knows no pull request for", () => {
    const { targetsByAlias } = build([target()]);

    expect(
      parsePrQueryResponse(
        data({ r0: { [firstAlias(targetsByAlias)]: { nodes: [] } } }),
        targetsByAlias,
      ),
    ).toEqual([]);
  });

  /**
   * GitHub answers a query naming a repository the token cannot see with that
   * alias null *next to* the ones that resolved. Dropping the whole answer would
   * throw away state that was already paid for.
   */
  it("keeps the repos that resolved when one comes back null", () => {
    const { targetsByAlias } = build([
      target(),
      target({
        branchId: "branch-2",
        taskId: "task-2",
        ownerRepo: "owner/private",
        branch: "feature/two",
      }),
    ]);

    const found = parsePrQueryResponse(
      data({
        r0: {
          [firstAlias(targetsByAlias)]: {
            nodes: [pullRequest({ number: 11 })],
          },
        },
        r1: null,
      }),
      targetsByAlias,
    );

    expect(found).toHaveLength(1);
    expect(found[0]?.number).toBe(11);
    expect(found[0]?.target.taskId).toBe("task-1");
  });

  it("produces every pull request of a branch, newest first as GitHub sends them", () => {
    const { targetsByAlias } = build([target()]);

    const found = parsePrQueryResponse(
      data({
        r0: {
          [firstAlias(targetsByAlias)]: {
            nodes: [
              pullRequest({ number: 12 }),
              pullRequest({
                number: 9,
                state: "MERGED",
                mergedAt: "2026-11-01T10:00:00Z",
                closedAt: "2026-11-01T10:00:00Z",
              }),
            ],
          },
        },
      }),
      targetsByAlias,
    );

    expect(found.map(({ number, state }) => ({ number, state }))).toEqual([
      { number: 12, state: "open" },
      { number: 9, state: "merged" },
    ]);
    expect(
      found.every(({ target: { branchId } }) => branchId === "branch-1"),
    ).toBe(true);
  });

  it("keeps when a pull request was closed, null while it is open", () => {
    expect(
      parseOne(
        pullRequest({ state: "CLOSED", closedAt: "2026-11-02T08:00:00Z" }),
      )[0]?.closedAt,
    ).toBe("2026-11-02T08:00:00Z");
    expect(parseOne(pullRequest())[0]?.closedAt).toBeNull();
  });

  it("produces nothing when the whole query failed", () => {
    const { targetsByAlias } = build([target()]);
    expect(parsePrQueryResponse(null, targetsByAlias)).toEqual([]);
  });
});
