import type { PrState } from "../types/entities.ts";
import type {
  ReviewflowAccount,
  ReviewflowChecksConclusion,
  ReviewflowMergeable,
  ReviewflowPrChanges,
  ReviewflowReviewState,
  ReviewflowStatusLink,
} from "../types/reviewflow.ts";

/**
 * The read api of reviewflow (`reviewflow/docs/api.md`), the read endpoints
 * a pull request screen needs and nothing more. The answers are checked field by field before use:
 * a server on another version must fail here with a message, not write a
 * `undefined` state into `pr`.
 */

export const reviewflowErrorCode = "ERR_REVIEWFLOW";

const timeoutMs = 15_000;
export const maxLookupTargets = 200;
/** pages past the first, per bucket: requested reviews alone reach 120 today */
export const maxExtraPagesPerBucket = 5;

/** GitHub's REST values, lowercase; `null` where reviewflow stored the run before the field */
export interface ReviewflowCheckRun {
  name: string;
  status: string | null;
  conclusion: string | null;
  title: string | null;
  detailsUrl: string | null;
}

export interface ReviewflowCommitStatus {
  context: string;
  state: string;
  description: string | null;
  targetUrl: string | null;
}

export interface ReviewflowPrDetail {
  id: string;
  ownerRepo: string;
  number: number;
  title: string;
  url: string;
  headRef: string | null;
  baseRef: string | null;
  headSha: string | null;
  /** absent from a reviewflow that predates it */
  baseSha: string | null;
  state: PrState | null;
  reviewState: ReviewflowReviewState | null;
  author: string | null;
  checks: {
    conclusion: ReviewflowChecksConclusion;
    passed: number;
    failed: number;
    pending: number;
    running: number;
    failedNames: string[];
    /** every check run of the head; null from a reviewflow that predates the list */
    checkRuns: ReviewflowCheckRun[] | null;
    /** every commit status of the head; null alongside `checkRuns` */
    statuses: ReviewflowCommitStatus[] | null;
  };
  lintFailed: boolean;
  approvedBy: string[];
  changesRequestedBy: string[];
  /** asked for the first time */
  requestedReviewers: string[];
  /** asked again after having reviewed */
  reRequestedReviewers: string[];
  requestedTeams: string[];
  assignees: string[];
  /** label names, in reviewflow's order */
  labels: string[];
  statusLinks: ReviewflowStatusLink[];
  openedAt: string | null;
  approvedAt: string | null;
  changes: ReviewflowPrChanges | null;
  unresolvedThreads: number | null;
  mergeable: ReviewflowMergeable;
  closedAt: string | null;
  /** the last conversation comment created, edited or deleted */
  commentActivityAt: string | null;
  /** the last review submitted, whatever its verdict */
  reviewActivityAt: string | null;
  /** the last review comment created, edited or deleted, a reply in a thread included */
  reviewCommentActivityAt: string | null;
  /** the last edit of the description */
  bodyEditedAt: string | null;
  updatedAt: string;
}

/**
 * `GET /api/reviewflow/pr?repo=<owner/repo>&number=<n>`: null without a token,
 * for a pull request reviewflow never handled, or one the token cannot read.
 */
export interface ReviewflowPrResponse {
  pr: ReviewflowPrDetail | null;
}

export interface ReviewflowMe {
  login: string;
  accounts: ReviewflowAccount[];
}

export interface ReviewflowLookupTarget {
  ownerRepo: string;
  headRef: string;
}

export type ReviewflowLookupResult =
  | { found: false; reason: "forbidden" | "noPr" | "notTracked" }
  | { found: true; pr: ReviewflowPrDetail };

export interface ReviewflowBucket {
  key: string;
  title: string;
  total: number;
  prs: ReviewflowPrDetail[];
}

export interface ReviewflowGroup {
  key: string;
  title: string;
  buckets: ReviewflowBucket[];
}

export interface ReviewflowClosedPrs {
  /** every match in reviewflow; `prs` stops at the first page */
  total: number;
  /** most recently closed first */
  prs: ReviewflowPrDetail[];
}

export interface ReviewflowClient {
  me: () => Promise<ReviewflowMe>;
  /** same order as `targets`, whatever their number */
  lookup: (
    targets: ReviewflowLookupTarget[],
  ) => Promise<ReviewflowLookupResult[]>;
  /** one account's board, with up to `maxExtraPagesPerBucket` more pages per bucket */
  board: (account: string) => Promise<ReviewflowGroup[]>;
  /** `account` null spans every account the token reads */
  closedPrs: (account: string | null) => Promise<ReviewflowClosedPrs>;
  /** null when reviewflow never handled it, or the token cannot read its owner */
  pr: (ownerRepo: string, number: number) => Promise<ReviewflowPrDetail | null>;
}

export interface ReviewflowFailure extends Error {
  code: string;
  status: number | undefined;
  /** from `Retry-After`, on a `429` or a `503` */
  retryAfterMs: number | undefined;
}

export const fail = (
  message: string,
  { status, retryAfterMs }: { status?: number; retryAfterMs?: number } = {},
): ReviewflowFailure =>
  Object.assign(new Error(message), {
    code: reviewflowErrorCode,
    status,
    retryAfterMs,
  });

export const isReviewflowFailure = (
  error: unknown,
): error is ReviewflowFailure =>
  error instanceof Error &&
  (error as Partial<ReviewflowFailure>).code === reviewflowErrorCode;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stringOrNull = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

const numberOr = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const prStates = new Set<string>(["closed", "draft", "merged", "open"]);
const reviewStates = new Set<string>([
  "approved",
  "changesRequested",
  "none",
  "requested",
]);
const mergeables = new Set<string>(["conflicting", "mergeable", "unknown"]);

const checksConclusions: Record<string, ReviewflowChecksConclusion> = {
  failed: "failed",
  "in-progress": "inProgress",
  passed: "passed",
};

const enumOrNull = <Value extends string>(
  value: unknown,
  allowed: Set<string>,
): Value | null =>
  typeof value === "string" && allowed.has(value) ? (value as Value) : null;

const strings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

const logins = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.flatMap((person: unknown) =>
        isRecord(person) && typeof person.login === "string"
          ? [person.login]
          : [],
      )
    : [];

/** the links reviewflow resolved, a ticket key among them; not the failed or pending ones */
const readCheckRuns = (value: unknown): ReviewflowCheckRun[] | null =>
  Array.isArray(value)
    ? value.flatMap((run: unknown) =>
        isRecord(run) && typeof run.name === "string"
          ? [
              {
                name: run.name,
                status: stringOrNull(run.status),
                conclusion: stringOrNull(run.conclusion),
                title: stringOrNull(run.title),
                detailsUrl: stringOrNull(run.detailsUrl),
              },
            ]
          : [],
      )
    : null;

const readCommitStatuses = (value: unknown): ReviewflowCommitStatus[] | null =>
  Array.isArray(value)
    ? value.flatMap((status: unknown) =>
        isRecord(status) &&
        typeof status.context === "string" &&
        typeof status.state === "string"
          ? [
              {
                context: status.context,
                state: status.state,
                description: stringOrNull(status.description),
                targetUrl: stringOrNull(status.targetUrl),
              },
            ]
          : [],
      )
    : null;

const readStatusLinks = (value: unknown): ReviewflowStatusLink[] =>
  Array.isArray(value)
    ? value.flatMap((link: unknown) =>
        isRecord(link) &&
        link.type === "success" &&
        typeof link.name === "string" &&
        typeof link.label === "string" &&
        typeof link.url === "string"
          ? [{ name: link.name, label: link.label, url: link.url }]
          : [],
      )
    : [];

const readLabels = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.flatMap((label: unknown) =>
        isRecord(label) && typeof label.name === "string" ? [label.name] : [],
      )
    : [];

/** reviewflow leaves `changes` out of the json when it does not know them */
const readChanges = (value: unknown): ReviewflowPrChanges | null =>
  isRecord(value) &&
  typeof value.changedFiles === "number" &&
  typeof value.additions === "number" &&
  typeof value.deletions === "number"
    ? {
        changedFiles: value.changedFiles,
        additions: value.additions,
        deletions: value.deletions,
      }
    : null;

/** A state reviewflow adds later reads as unknown, never as one this client knows. */
export const readPrDetail = (value: unknown): ReviewflowPrDetail => {
  if (
    !isRecord(value) ||
    typeof value._id !== "string" ||
    typeof value.ownerRepo !== "string" ||
    typeof value.number !== "number" ||
    typeof value.url !== "string" ||
    !isRecord(value.checks)
  ) {
    throw fail("reviewflow returned a pull request the client cannot read");
  }
  const { checks } = value;
  const creator = isRecord(value.creator) ? value.creator : null;
  const flowDates = isRecord(value.flowDates) ? value.flowDates : {};

  return {
    id: value._id,
    ownerRepo: value.ownerRepo,
    number: value.number,
    title: typeof value.title === "string" ? value.title : "",
    url: value.url,
    headRef: stringOrNull(value.headRef),
    baseRef: stringOrNull(value.baseRef),
    headSha: stringOrNull(value.headSha),
    baseSha: stringOrNull(value.baseSha),
    state: enumOrNull<PrState>(value.state, prStates),
    reviewState: enumOrNull<ReviewflowReviewState>(
      value.reviewState,
      reviewStates,
    ),
    author: stringOrNull(creator?.login),
    checks: {
      conclusion:
        typeof checks.conclusion === "string"
          ? (checksConclusions[checks.conclusion] ?? "unknown")
          : "unknown",
      passed: numberOr(checks.passed, 0),
      failed: numberOr(checks.failed, 0),
      pending: numberOr(checks.pending, 0),
      running: numberOr(checks.runningCount, 0),
      failedNames: strings(checks.failedNames),
      checkRuns: readCheckRuns(checks.checkRuns),
      statuses: readCommitStatuses(checks.statuses),
    },
    lintFailed: value.lintFailed === true,
    approvedBy: logins(value.approvedBy),
    changesRequestedBy: logins(value.changesRequestedBy),
    requestedReviewers: logins(value.requestedReviewers),
    reRequestedReviewers: logins(value.reRequestedReviewers),
    requestedTeams: strings(value.requestedTeams),
    assignees: logins(value.assignees),
    labels: readLabels(value.labels),
    statusLinks: readStatusLinks(value.statusLinks),
    openedAt: stringOrNull(flowDates.openedAt),
    approvedAt: stringOrNull(flowDates.approvedAt),
    changes: readChanges(value.changes),
    unresolvedThreads:
      typeof value.unresolvedThreads === "number"
        ? value.unresolvedThreads
        : null,
    mergeable:
      enumOrNull<ReviewflowMergeable>(value.mergeable, mergeables) ?? "unknown",
    closedAt: stringOrNull(flowDates.closedAt),
    commentActivityAt: stringOrNull(flowDates.lastCommentActivityAt),
    reviewActivityAt: stringOrNull(flowDates.lastReviewSubmittedAt),
    reviewCommentActivityAt: stringOrNull(
      flowDates.lastReviewCommentActivityAt,
    ),
    bodyEditedAt: stringOrNull(flowDates.lastBodyEditedAt),
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : "",
  };
};

const lookupReasons = new Set<string>(["forbidden", "noPr", "notTracked"]);

const readLookupResult = (value: unknown): ReviewflowLookupResult => {
  if (isRecord(value) && value.found === true) {
    return { found: true, pr: readPrDetail(value.pr) };
  }
  if (
    isRecord(value) &&
    value.found === false &&
    typeof value.reason === "string" &&
    lookupReasons.has(value.reason)
  ) {
    return {
      found: false,
      reason: value.reason as "forbidden" | "noPr" | "notTracked",
    };
  }
  // an unknown reason is the one answer that cannot be trusted as `noPr`
  return { found: false, reason: "notTracked" };
};

interface BucketPage {
  key: string;
  title: string;
  total: number;
  prs: ReviewflowPrDetail[];
  nextPage: string | null;
}

const readBucketPage = (value: unknown): BucketPage => {
  if (
    !isRecord(value) ||
    typeof value.key !== "string" ||
    !Array.isArray(value.prs)
  ) {
    throw fail("reviewflow returned a board bucket the client cannot read");
  }
  return {
    key: value.key,
    title: typeof value.title === "string" ? value.title : value.key,
    total: numberOr(value.total, value.prs.length),
    prs: value.prs.map(readPrDetail),
    nextPage: stringOrNull(value.nextPage),
  };
};

const readMe = (value: unknown): ReviewflowMe => {
  if (
    !isRecord(value) ||
    !isRecord(value.user) ||
    typeof value.user.login !== "string" ||
    !Array.isArray(value.accounts)
  ) {
    throw fail("reviewflow returned a /me the client cannot read");
  }
  return {
    login: value.user.login,
    accounts: value.accounts.filter(isRecord).map((account) => ({
      login: String(account.login),
      type: account.type === "Organization" ? "Organization" : "User",
    })),
  };
};

/** an HTTP date in `Retry-After` is not something this api sends */
const readRetryAfterMs = (response: Response): number | undefined => {
  const seconds = Number(response.headers.get("retry-after") ?? Number.NaN);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : undefined;
};

/** The api's own envelope when there is one, the status otherwise. */
export const responseFailure = async (
  response: Response,
): Promise<ReviewflowFailure> => {
  const body: unknown = await response.json().catch(() => null);
  const error = isRecord(body) && isRecord(body.error) ? body.error : null;
  const detail =
    error === null
      ? ""
      : ` ${String(error.code)}: ${typeof error.message === "string" ? error.message : ""}`;
  const retryAfter = response.headers.get("retry-after");
  const retry = retryAfter === null ? "" : ` (retry after ${retryAfter}s)`;
  return fail(
    `reviewflow answered ${String(response.status)}${detail}${retry}`,
    { status: response.status, retryAfterMs: readRetryAfterMs(response) },
  );
};

interface CreateReviewflowClientParams {
  url: string;
  token: string;
  /** injected by tests: nothing in the suite reaches the network */
  fetch?: typeof globalThis.fetch;
}

const chunk = <Item>(items: Item[], size: number): Item[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );

export const createReviewflowClient = ({
  url,
  token,
  fetch = globalThis.fetch,
}: CreateReviewflowClientParams): ReviewflowClient => {
  const request = async (
    path: string,
    init: { method?: string; body?: unknown } = {},
  ): Promise<unknown> => {
    const response = await fetch(`${url}/api${path}`, {
      method: init.method ?? "GET",
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/json",
        ...(init.body === undefined
          ? {}
          : { "content-type": "application/json" }),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(timeoutMs),
    }).catch((error: unknown) => {
      const cause = error instanceof Error ? error.message : String(error);
      throw fail(`reviewflow could not be reached at ${url}: ${cause}`);
    });

    if (!response.ok) throw await responseFailure(response);
    return response.json().catch(() => {
      throw fail("reviewflow answered with a body that is not json");
    });
  };

  const readBucket = async (
    account: string,
    first: BucketPage,
  ): Promise<ReviewflowBucket> => {
    const prs = [...first.prs];
    let { nextPage } = first;
    for (
      let page = 0;
      nextPage !== null && page < maxExtraPagesPerBucket;
      page++
    ) {
      // a page token is only valid for the account it was issued for
      const query = new URLSearchParams({
        bucket: first.key,
        account,
        page: nextPage,
      });
      const next = readBucketPage(
        await request(`/board-bucket/v1?${query.toString()}`),
      );
      prs.push(...next.prs);
      ({ nextPage } = next);
    }
    // a page read live can repeat a row that moved between two reads
    const seen = new Set<string>();
    return {
      key: first.key,
      title: first.title,
      total: first.total,
      prs: prs.filter((pr) => !seen.has(pr.id) && seen.add(pr.id)),
    };
  };

  return {
    me: async () => readMe(await request("/me/v1")),

    lookup: async (targets) => {
      const answers = await Promise.all(
        chunk(targets, maxLookupTargets).map(async (part) => {
          const body = await request("/prs-lookup/v1", {
            method: "POST",
            body: { targets: part },
          });
          if (
            !isRecord(body) ||
            !Array.isArray(body.results) ||
            body.results.length !== part.length
          ) {
            throw fail("reviewflow returned a lookup the client cannot read");
          }
          return body.results.map(readLookupResult);
        }),
      );
      return answers.flat();
    },

    closedPrs: async (account) => {
      const query =
        account === null
          ? ""
          : `?${new URLSearchParams({ account }).toString()}`;
      const body = await request(`/closed-prs/v1${query}`);
      if (!isRecord(body) || !Array.isArray(body.prs)) {
        throw fail(
          "reviewflow returned closed pull requests the client cannot read",
        );
      }
      return {
        total: numberOr(body.total, body.prs.length),
        prs: body.prs.map(readPrDetail),
      };
    },

    pr: async (ownerRepo, number) => {
      const path = ownerRepo
        .split("/")
        .map((part) => encodeURIComponent(part))
        .join("/");
      try {
        return readPrDetail(await request(`/pr/v1/${path}/${String(number)}`));
      } catch (error) {
        if (
          isReviewflowFailure(error) &&
          (error.status === 403 || error.status === 404)
        ) {
          return null;
        }
        throw error;
      }
    },

    board: async (account) => {
      const body = await request(
        `/board/v1?${new URLSearchParams({ account }).toString()}`,
      );
      if (!isRecord(body) || !Array.isArray(body.groups)) {
        throw fail("reviewflow returned a board the client cannot read");
      }
      return Promise.all(
        body.groups.map(async (group: unknown): Promise<ReviewflowGroup> => {
          if (
            !isRecord(group) ||
            typeof group.key !== "string" ||
            !Array.isArray(group.buckets)
          ) {
            throw fail(
              "reviewflow returned a board group the client cannot read",
            );
          }
          return {
            key: group.key,
            title: typeof group.title === "string" ? group.title : group.key,
            buckets: await Promise.all(
              group.buckets.map((bucket: unknown) =>
                readBucket(account, readBucketPage(bucket)),
              ),
            ),
          };
        }),
      );
    },
  };
};
