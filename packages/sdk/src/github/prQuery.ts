import type {
  PrMergeable,
  PrReviewDecision,
  PrState,
} from "../types/entities.ts";

/**
 * One branch to ask GitHub about — a task's current branch, which is the only
 * branch a PR is wanted for (a task has N branches over time and only the
 * latest one is live).
 */
export interface PrQueryTarget {
  branchId: string;
  taskId: string;
  /** `owner/repo`, from `repo.owner_repo` */
  ownerRepo: string;
  branch: string;
}

export interface PrQuery {
  query: string;
  /** alias -> the branch it asks about; how an answer is matched back */
  targetsByAlias: Map<string, PrQueryTarget>;
}

/**
 * Every branch is one aliased field in one document, so the whole board costs a
 * single HTTP request and — because every connection is asked for `first: 1` —
 * a single point of the GraphQL rate limit. A query per PR would be one request
 * and one point *each*, which is the thing this exists to avoid.
 *
 * The counts come off `checkRunCountsByState` / `statusContextCountsByState`
 * rather than off the context nodes: those are aggregates GitHub computes, so
 * `contexts(first: 1)` returns exact totals for a PR with two hundred checks
 * without transferring or paying for them.
 */
export const prFields = `fragment prFields on PullRequest {
  number
  state
  isDraft
  reviewDecision
  reviewRequests(first: 1) { totalCount }
  mergedAt
  mergeable
  headRefOid
  baseRefName
  commits(last: 1) {
    nodes {
      commit {
        statusCheckRollup {
          contexts(first: 1) {
            checkRunCountsByState { count state }
            statusContextCountsByState { count state }
          }
        }
      }
    }
  }
}`;

/**
 * `owner/repo` exactly, because that is what the GraphQL arguments are. A value
 * that does not split into two segments is skipped rather than guessed at: it
 * would resolve to a repository that is not the operator's, and registration
 * already refuses a repo with no usable remote.
 */
export const splitOwnerRepo = (
  ownerRepo: string,
): { owner: string; name: string } | null => {
  const segments = ownerRepo.split("/");
  const [owner, name] = segments;
  if (segments.length !== 2 || !owner || !name) return null;
  return { owner, name };
};

/** Returns null when no target is queryable, so no request is made at all. */
export const buildPrQuery = (targets: PrQueryTarget[]): PrQuery | null => {
  const byRepo = new Map<string, { alias: string; branch: string }[]>();
  const targetsByAlias = new Map<string, PrQueryTarget>();

  targets.forEach((target, index) => {
    if (target.branch === "" || splitOwnerRepo(target.ownerRepo) === null) {
      return;
    }
    const alias = `t${String(index)}`;
    targetsByAlias.set(alias, target);
    const existing = byRepo.get(target.ownerRepo);
    const entry = { alias, branch: target.branch };
    if (existing) existing.push(entry);
    else byRepo.set(target.ownerRepo, [entry]);
  });

  if (targetsByAlias.size === 0) return null;

  const repoBlocks = [...byRepo].map(([ownerRepo, branches], repoIndex) => {
    const { owner, name } = splitOwnerRepo(ownerRepo) as {
      owner: string;
      name: string;
    };
    const branchFields = branches.map(
      ({ alias, branch }) =>
        // Newest first: a branch that had a closed PR and then a new one is
        // described by the new one, and `first: 1` is what keeps the cost flat.
        `    ${alias}: pullRequests(headRefName: ${JSON.stringify(branch)}, first: 1, orderBy: { field: CREATED_AT, direction: DESC }) { nodes { ...prFields } }`,
    );
    return [
      `  r${String(repoIndex)}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(name)}) {`,
      ...branchFields,
      "  }",
    ].join("\n");
  });

  return {
    query: `query {\n${repoBlocks.join("\n")}\n}\n\n${prFields}`,
    targetsByAlias,
  };
};

interface GhCountByState {
  count: number;
  state: string;
}

export interface GhPullRequest {
  number: number;
  state: string;
  isDraft: boolean;
  reviewDecision: string | null;
  /** pending only: GitHub drops a request once its reviewer submits a review */
  reviewRequests: { totalCount: number };
  mergedAt: string | null;
  mergeable: string;
  headRefOid: string;
  baseRefName: string;
  commits: {
    nodes: {
      commit: {
        statusCheckRollup: {
          contexts: {
            checkRunCountsByState: GhCountByState[] | null;
            statusContextCountsByState: GhCountByState[] | null;
          };
        } | null;
      };
    }[];
  };
}

/**
 * Repository aliases at the top level, branch aliases inside each. A repository
 * the token cannot see comes back as a null alias next to the ones that
 * resolved, which is why this reads defensively rather than asserting a shape.
 */
export type PrQueryData = Record<
  string,
  Record<string, { nodes: (GhPullRequest | null)[] | null } | null> | null
>;

/**
 * How GitHub's rollup states fold into the three counts `pr` keeps.
 *
 * A whitelist, like the hook mapper: a state GitHub adds later is ignored
 * rather than counted as something, because the one thing worse than an
 * unranked board is a board that calls a red PR green.
 *
 * `CANCELLED` and `STALE` count as pending rather than failed on purpose. They
 * mean "no answer for this commit" — a superseded run after a force-push is the
 * common cause — and calling that a failure would raise `checksFailing` on a
 * PR nobody needs to look at, which is how an attention signal stops being read.
 */
export const checkOutcomes = new Map<string, "failed" | "passed" | "pending">([
  ["ACTION_REQUIRED", "failed"],
  ["ERROR", "failed"],
  ["FAILURE", "failed"],
  ["STARTUP_FAILURE", "failed"],
  ["TIMED_OUT", "failed"],

  ["COMPLETED", "passed"],
  ["NEUTRAL", "passed"],
  ["SKIPPED", "passed"],
  ["SUCCESS", "passed"],

  ["CANCELLED", "pending"],
  ["EXPECTED", "pending"],
  ["IN_PROGRESS", "pending"],
  ["PENDING", "pending"],
  ["QUEUED", "pending"],
  ["STALE", "pending"],
  ["WAITING", "pending"],
]);

interface CheckCounts {
  checksPassed: number;
  checksFailed: number;
  checksPending: number;
}

const countChecks = (pullRequest: GhPullRequest): CheckCounts => {
  const totals = { failed: 0, passed: 0, pending: 0 };
  const contexts =
    pullRequest.commits.nodes[0]?.commit.statusCheckRollup?.contexts;

  for (const { count, state } of [
    ...(contexts?.checkRunCountsByState ?? []),
    ...(contexts?.statusContextCountsByState ?? []),
  ]) {
    const outcome = checkOutcomes.get(state);
    if (outcome !== undefined) totals[outcome] += count;
  }

  return {
    checksPassed: totals.passed,
    checksFailed: totals.failed,
    checksPending: totals.pending,
  };
};

/** `isDraft` is a separate field upstream; `pr.state` folds it in. */
const prStates = new Map<string, PrState>([
  ["CLOSED", "closed"],
  ["MERGED", "merged"],
]);

const toPrState = (state: string, isDraft: boolean): PrState | null => {
  if (state === "OPEN") return isDraft ? "draft" : "open";
  return prStates.get(state) ?? null;
};

const reviewDecisions = new Map<string, PrReviewDecision>([
  ["APPROVED", "approved"],
  ["CHANGES_REQUESTED", "changesRequested"],
  ["REVIEW_REQUIRED", "reviewRequired"],
]);

/**
 * reviewflow's precedence (`toReviewState`): changes requested, then a pending
 * review request, then GitHub's decision. GitHub answers `APPROVED` as soon as
 * the required approvals are in, with other reviewers still asked, and `null`
 * on a repository that requires no review, whoever was asked — both would put
 * a pull request somebody is still reviewing in the operator's hands.
 */
const toReviewDecision = ({
  reviewDecision,
  reviewRequests,
}: Pick<
  GhPullRequest,
  "reviewDecision" | "reviewRequests"
>): PrReviewDecision => {
  const decision =
    reviewDecision === null
      ? null
      : (reviewDecisions.get(reviewDecision) ?? null);
  if (decision === "changesRequested") return decision;
  return reviewRequests.totalCount > 0 ? "reviewRequired" : decision;
};

const mergeables = new Map<string, PrMergeable>([
  ["CONFLICTING", "conflicting"],
  ["MERGEABLE", "mergeable"],
]);

export interface FetchedPr extends CheckCounts {
  target: PrQueryTarget;
  number: number;
  state: PrState;
  reviewDecision: PrReviewDecision;
  mergeable: PrMergeable;
  mergedAt: string | null;
  /** always set by GitHub; null only from a reviewflow document that lacks it */
  headSha: string | null;
  /** null only from a reviewflow server that predates `baseRef` */
  baseRef: string | null;
}

/** Null for a state GitHub added after this was written. */
export const toFetchedPr = (
  target: PrQueryTarget,
  pullRequest: GhPullRequest,
): FetchedPr | null => {
  const state = toPrState(pullRequest.state, pullRequest.isDraft);
  if (state === null) return null;
  return {
    target,
    number: pullRequest.number,
    state,
    reviewDecision: toReviewDecision(pullRequest),
    mergeable: mergeables.get(pullRequest.mergeable) ?? "unknown",
    mergedAt: pullRequest.mergedAt,
    headSha: pullRequest.headRefOid,
    baseRef: pullRequest.baseRefName,
    ...countChecks(pullRequest),
  };
};

/**
 * Only the aliases that both resolved and carry a pull request produce a row. A
 * branch with no PR is not an absence to record — it is the normal state of a
 * worktree whose work has not been pushed for review yet.
 */
export const parsePrQueryResponse = (
  data: PrQueryData | null,
  targetsByAlias: Map<string, PrQueryTarget>,
): FetchedPr[] => {
  if (data === null) return [];
  const found: FetchedPr[] = [];

  for (const repository of Object.values(data)) {
    if (!repository) continue;
    for (const [alias, connection] of Object.entries(repository)) {
      const target = targetsByAlias.get(alias);
      const pullRequest = connection?.nodes?.[0];
      if (!target || !pullRequest) continue;

      const fetched = toFetchedPr(target, pullRequest);
      if (fetched !== null) found.push(fetched);
    }
  }

  return found;
};
