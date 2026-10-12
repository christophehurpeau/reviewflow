import type { PrMergeable } from "reviewflow-modules";
import type { AppContext } from "../../../context/AppContext.ts";
import type {
  EventsWithRepository,
  RepoContext,
} from "../../../context/repoContext.ts";
import type { ProbotEvent } from "../../probot-types.ts";
import {
  markMergeConflictAsDone,
  syncMergeConflictSlackMessage,
} from "../actions/mergeConflictSlackMessage.ts";
import { getMergeableFromPullRequest } from "./createPullRequestContext.ts";
import { fetchPr } from "./fetchPr.ts";

export type MergeableRefreshTarget = { baseRef: string } | { prNumber: number };

/**
 * github computes `mergeable` in the background, started by the read itself:
 * the first read after a push is often still `UNKNOWN`.
 */
export const mergeableRefreshDelaysMs = [10_000, 30_000, 90_000] as const;

type GraphqlMergeable = "CONFLICTING" | "MERGEABLE" | "UNKNOWN";

const graphqlMergeableToPrMergeable: Record<GraphqlMergeable, PrMergeable> = {
  CONFLICTING: "conflicting",
  MERGEABLE: "mergeable",
  UNKNOWN: "unknown",
};

interface OpenPullRequestsMergeableQueryResult {
  repository: {
    pullRequests: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: {
        number: number;
        databaseId: number;
        mergeable: GraphqlMergeable;
      }[];
    };
  } | null;
}

const openPullRequestsMergeableQuery = `
query openPullRequestsMergeable($owner: String!, $repo: String!, $baseRefName: String!, $after: String) {
  repository(owner: $owner, name: $repo) {
    pullRequests(states: OPEN, baseRefName: $baseRefName, first: 100, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        number
        databaseId
        mergeable
      }
    }
  }
}`;

interface PullRequestMergeable {
  number: number;
  id: number;
  mergeable: PrMergeable;
}

const fetchOpenPullRequestsMergeable = async <
  EventName extends EventsWithRepository,
>(
  context: ProbotEvent<EventName>,
  baseRef: string,
): Promise<PullRequestMergeable[]> => {
  const fetchPage = (
    after: string | null,
  ): Promise<OpenPullRequestsMergeableQueryResult> =>
    context.octokit.graphql<OpenPullRequestsMergeableQueryResult>(
      openPullRequestsMergeableQuery,
      { ...context.repo(), baseRefName: baseRef, after },
    );

  const pullRequests: PullRequestMergeable[] = [];
  let after: string | null = null;

  do {
    const { repository } = await fetchPage(after);
    if (!repository) break;

    const { nodes, pageInfo } = repository.pullRequests;
    pullRequests.push(
      ...nodes.map((node) => ({
        number: node.number,
        id: node.databaseId,
        mergeable: graphqlMergeableToPrMergeable[node.mergeable],
      })),
    );
    after = pageInfo.hasNextPage ? pageInfo.endCursor : null;
  } while (after);

  return pullRequests;
};

const storeMergeable = (
  appContext: AppContext,
  repoContext: RepoContext,
  prNumber: number,
  mergeable: PrMergeable,
): Promise<unknown> =>
  appContext.mongoStores.prs.partialUpdateMany(
    {
      "account.id": repoContext.accountEmbed.id,
      "repo.id": repoContext.repoEmbed.id,
      "pr.number": prNumber,
    },
    { $set: { mergeable } },
  );

interface RefreshOptions<EventName extends EventsWithRepository> {
  context: ProbotEvent<EventName>;
  appContext: AppContext;
  repoContext: RepoContext;
}

/** @returns the numbers of the pull requests whose `mergeable` is still unknown */
const refreshBaseMergeable = async <EventName extends EventsWithRepository>(
  { context, appContext, repoContext }: RefreshOptions<EventName>,
  baseRef: string,
  onlyPrNumbers: ReadonlySet<number> | undefined,
): Promise<Set<number>> => {
  const openPullRequests = await fetchOpenPullRequestsMergeable(
    context,
    baseRef,
  );
  const pullRequests = openPullRequests.filter(
    ({ number }) => !onlyPrNumbers || onlyPrNumbers.has(number),
  );

  await Promise.all(
    pullRequests
      .filter(({ mergeable }) => mergeable !== "unknown")
      .map((pr) =>
        repoContext.lockPullRequest("mergeable-refresh", pr, async () => {
          await storeMergeable(
            appContext,
            repoContext,
            pr.number,
            pr.mergeable,
          );
          if (pr.mergeable === "mergeable") {
            await markMergeConflictAsDone(appContext, repoContext, pr.id);
            return;
          }
          // the message needs the owner, assignees and link: only conflicting pull requests pay this read
          const pullRequest = await fetchPr(context, pr.number);
          await syncMergeConflictSlackMessage(appContext, repoContext, {
            pullRequest,
            mergeable: pr.mergeable,
          });
        }),
      ),
  );

  return new Set(
    pullRequests
      .filter(({ mergeable }) => mergeable === "unknown")
      .map(({ number }) => number),
  );
};

/** @returns the pull request number when its `mergeable` is still unknown */
const refreshPullRequestMergeable = async <
  EventName extends EventsWithRepository,
>(
  { context, appContext, repoContext }: RefreshOptions<EventName>,
  prNumber: number,
): Promise<Set<number>> => {
  const unknownPrNumbers = new Set<number>();

  await repoContext.lockPullRequest(
    "mergeable-refresh",
    { number: prNumber },
    async () => {
      const pullRequest = await fetchPr(context, prNumber);
      const mergeable =
        getMergeableFromPullRequest(pullRequest)?.mergeable ?? "unknown";
      if (mergeable === "unknown") {
        unknownPrNumbers.add(prNumber);
        return;
      }

      await Promise.all([
        storeMergeable(appContext, repoContext, prNumber, mergeable),
        syncMergeConflictSlackMessage(appContext, repoContext, {
          pullRequest,
          mergeable,
        }),
      ]);
    },
  );

  return unknownPrNumbers;
};

const pendingRefreshes = new Map<string, NodeJS.Timeout>();

/**
 * Re-reads `mergeable` after a push, since github sends no event once it has
 * computed it, retrying while it is still unknown. A new schedule for the same
 * base branch or pull request replaces the pending one. Timers live in memory:
 * a restart drops them, leaving `unknown` until the next payload.
 */
export const scheduleMergeableRefresh = <
  EventName extends EventsWithRepository,
>(
  options: RefreshOptions<EventName>,
  target: MergeableRefreshTarget,
): void => {
  const { context, repoContext } = options;
  const key =
    "baseRef" in target
      ? `${repoContext.repoEmbed.id}:${target.baseRef}`
      : `${repoContext.repoEmbed.id}#${target.prNumber}`;

  const refresh = (
    onlyPrNumbers: ReadonlySet<number> | undefined,
  ): Promise<Set<number>> =>
    "baseRef" in target
      ? refreshBaseMergeable(options, target.baseRef, onlyPrNumbers)
      : refreshPullRequestMergeable(options, target.prNumber);

  const scheduleAttempt = (
    attempt: number,
    onlyPrNumbers?: ReadonlySet<number>,
  ): void => {
    clearTimeout(pendingRefreshes.get(key));
    const timeout = setTimeout(() => {
      pendingRefreshes.delete(key);
      refresh(onlyPrNumbers).then(
        (unknownPrNumbers) => {
          if (unknownPrNumbers.size === 0) return;
          // a newer schedule, made while this attempt ran, covers every pull request
          if (pendingRefreshes.has(key)) return;
          if (attempt + 1 >= mergeableRefreshDelaysMs.length) {
            context.log.info(
              { key, prNumbers: [...unknownPrNumbers] },
              "mergeable still unknown, giving up",
            );
            return;
          }
          scheduleAttempt(attempt + 1, unknownPrNumbers);
        },
        (error: unknown) => {
          context.log.error({ err: error, key }, "mergeable refresh failed");
        },
      );
    }, mergeableRefreshDelaysMs[attempt]);
    timeout.unref();
    pendingRefreshes.set(key, timeout);
  };

  scheduleAttempt(0);
};
