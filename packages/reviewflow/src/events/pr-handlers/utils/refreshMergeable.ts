import type { PrMergeable } from "@reviewflow/modules";
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
import {
  getInitialFlowDatesFromPullRequest,
  getMergeableFromPullRequest,
} from "./createPullRequestContext.ts";
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

/**
 * github does not guarantee a webhook: a `pull_request.closed` it never sends
 * leaves the pull request open here for good. Its merge still pushes the base,
 * which is what scheduled this refresh, so a pull request stored open on this
 * base that github no longer lists as open is read again, and stored closed
 * when it is.
 */
const storeMissedClosings = async <EventName extends EventsWithRepository>(
  { context, appContext, repoContext }: RefreshOptions<EventName>,
  baseRef: string,
  openPrNumbers: ReadonlySet<number>,
): Promise<void> => {
  const storedOpenPrs = await appContext.mongoStores.prs.findAll({
    "account.id": repoContext.accountEmbed.id,
    "repo.id": repoContext.repoEmbed.id,
    baseRef,
    isClosed: false,
  });

  await Promise.all(
    storedOpenPrs
      .filter(({ pr }) => !openPrNumbers.has(pr.number))
      .map((storedPr) =>
        repoContext.lockPullRequest(
          {
            log: context.log,
            eventName: "closed-refresh",
            pullRequest: storedPr.pr,
          },
          async () => {
            const pullRequest = await fetchPr(context, storedPr.pr.number);
            // retargeted to another base, still open
            if (!pullRequest.closed_at) return;

            await Promise.all([
              appContext.mongoStores.prs.partialUpdateByKey(storedPr._id, {
                $set: {
                  isClosed: true,
                  isMerged: pullRequest.merged,
                  ...(storedPr.flowDates
                    ? { "flowDates.closedAt": new Date(pullRequest.closed_at) }
                    : {
                        flowDates:
                          getInitialFlowDatesFromPullRequest(pullRequest),
                      }),
                },
              }),
              markMergeConflictAsDone(appContext, repoContext, pullRequest.id),
            ]);
            context.log.info(
              { prNumber: storedPr.pr.number, merged: pullRequest.merged },
              "closed without a pull_request.closed webhook: stored closed",
            );
          },
        ),
      ),
  );
};

/** @returns the numbers of the pull requests whose `mergeable` is still unknown */
const refreshBaseMergeable = async <EventName extends EventsWithRepository>(
  options: RefreshOptions<EventName>,
  baseRef: string,
  onlyPrNumbers: ReadonlySet<number> | undefined,
): Promise<Set<number>> => {
  const { context, appContext, repoContext } = options;
  const openPullRequests = await fetchOpenPullRequestsMergeable(
    context,
    baseRef,
  );
  if (!onlyPrNumbers) {
    // the open pull requests' `mergeable` does not depend on it
    await storeMissedClosings(
      options,
      baseRef,
      new Set(openPullRequests.map(({ number }) => number)),
    ).catch((error: unknown) => {
      context.log.error(
        { err: error, baseRef },
        "storing missed closings failed",
      );
    });
  }
  const pullRequests = openPullRequests.filter(
    ({ number }) => !onlyPrNumbers || onlyPrNumbers.has(number),
  );

  await Promise.all(
    pullRequests
      .filter(({ mergeable }) => mergeable !== "unknown")
      .map((pr) =>
        repoContext.lockPullRequest(
          { log: context.log, eventName: "mergeable-refresh", pullRequest: pr },
          async () => {
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
          },
        ),
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
    {
      log: context.log,
      eventName: "mergeable-refresh",
      pullRequest: { number: prNumber },
    },
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
