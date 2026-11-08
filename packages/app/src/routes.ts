/**
 * The JSON routes behind the app's data source: the same paths, query
 * parameters, bodies and answers as a pull request screen expects, minus any
 * cache (every read goes to GitHub). A handler takes the request as plain data
 * and answers `{ status, body }`, so the routes are exercised without binding
 * a port; `server.ts` only moves bytes.
 */
import type {
  DiffImpactsResponse,
  DiffReadingOrderResponse,
  DiffStep,
  DiffWhitespace,
  EditPullRequestRequest,
  EditPullRequestResponse,
  GitHubTransport,
  PullRequestCandidatesResponse,
  PullRequestDiffResponse,
  PullRequestFileContentsResponse,
  PullRequestPart,
  PullRequestPartResponse,
  PullRequestRef,
  PullRequestRevisionsResponse,
} from "@reviewflow/sdk";
import { isDiffWhitespace, isPullRequestPart } from "@reviewflow/sdk";
import { readEditableFile, saveEditableFile } from "@reviewflow/sdk/files";
import {
  describeRepoAttachment,
  resolveCheckout,
  validateConfigSource,
} from "./config.ts";
import { credentialsUnreadableCode } from "./credentials/store.ts";
import { errorMessage } from "./errorMessage.ts";
import type {
  ReviewflowService,
  SetReviewflowTokenRequest,
} from "./reviewflowService.ts";
import { tokenRefusedCode } from "./reviewflowService.ts";

export const apiRoutes = {
  configFile: "/api/config/file",
  configRepo: "/api/config/repo",
  prDetail: "/api/prs/detail",
  prCandidates: "/api/prs/candidates",
  prRevisions: "/api/prs/revisions",
  prEdit: "/api/prs/edit",
  prDiff: "/api/prs/diff",
  prFile: "/api/prs/file",
  prReadingOrder: "/api/prs/reading-order",
  prImpacts: "/api/prs/impacts",
  reviewflowStatus: "/api/reviewflow/status",
  reviewflowToken: "/api/reviewflow/token",
  reviewflowBoard: "/api/reviewflow/board",
  reviewflowPr: "/api/reviewflow/pr",
  events: "/api/events",
} as const;

/** What the routes call; wired to `@reviewflow/sdk` in `operations.ts`. */
export interface PullRequestOperations {
  fetchPullRequestPart: <Part extends PullRequestPart>(
    transport: GitHubTransport,
    ref: PullRequestRef,
    part: Part,
  ) => Promise<PullRequestPartResponse<Part>>;
  fetchPullRequestCandidates: (
    transport: GitHubTransport,
    ref: PullRequestRef,
  ) => Promise<PullRequestCandidatesResponse>;
  fetchPullRequestRevisions: (
    transport: GitHubTransport,
    subjectId: string,
  ) => Promise<PullRequestRevisionsResponse>;
  parsePullRequestEdit: (
    value: unknown,
  ) => EditPullRequestRequest["edit"] | string;
  editPullRequest: (
    transport: GitHubTransport,
    request: EditPullRequestRequest,
  ) => Promise<string | null>;
  readPullRequestDiff: (params: {
    checkout: string;
    transport: GitHubTransport;
    ref: PullRequestRef;
    head: string;
    base: string;
    whitespace: DiffWhitespace;
    onStep?: (step: DiffStep) => void;
  }) => Promise<PullRequestDiffResponse>;
  readFileAtSha: (
    checkout: string,
    sha: string,
    path: string,
  ) => Promise<string>;
  readReadingOrder: (params: {
    checkout: string;
    head: string;
    base: string;
  }) => Promise<DiffReadingOrderResponse>;
  readImpacts: (params: {
    checkout: string;
    head: string;
    base: string;
  }) => Promise<DiffImpactsResponse>;
}

export interface RouteDeps {
  transport: GitHubTransport;
  operations: PullRequestOperations;
  configPath: string;
  reviewflow: ReviewflowService;
}

export interface RouteRequest {
  method: string;
  pathname: string;
  query: URLSearchParams;
  /** reads the body on demand; only POST routes call it */
  readJson: () => Promise<unknown>;
  /** aborted when the client goes away before the answer */
  signal?: AbortSignal;
}

export interface RouteAnswer {
  status: number;
  body: unknown;
  /**
   * Set instead of `body` for a streamed answer: `application/x-ndjson`, one
   * json value per line, written as the iterable yields. Never throws: a
   * failure is its last line.
   */
  lines?: AsyncIterable<object>;
  /**
   * Set instead of `body` for `text/event-stream`: called once with the
   * connection's writer, returns how it is closed. The server writes the
   * headers and calls the closer when the socket does.
   */
  events?: (write: (chunk: string) => void) => () => void;
}

const ok = (body: unknown): RouteAnswer => ({ status: 200, body });
const bad = (error: string): RouteAnswer => ({ status: 400, body: { error } });
const notAllowed = (): RouteAnswer => ({
  status: 405,
  body: { error: "method not allowed" },
});

/** `owner/repo` and a positive number, or why not. */
const pullRequestRefOf = (
  ownerRepo: unknown,
  number: unknown,
): PullRequestRef | string => {
  if (typeof ownerRepo !== "string" || !/^[^/\s]+\/[^/\s]+$/.test(ownerRepo)) {
    return "repo must be owner/repo";
  }
  if (typeof number !== "number" || !Number.isInteger(number) || number < 1) {
    return "number must be a pull request number";
  }
  return { ownerRepo, number };
};

const isSha = (value: string): boolean => /^[\da-f]{40}$/i.test(value);

/** `?repo=&number=` of a GET. */
const readRef = (
  request: RouteRequest,
): RouteAnswer | { ref: PullRequestRef } => {
  const ref = pullRequestRefOf(
    request.query.get("repo"),
    Number(request.query.get("number") ?? ""),
  );
  return typeof ref === "string" ? bad(ref) : { ref };
};

const isAnswer = (value: object): value is RouteAnswer => "status" in value;

type Handler = (deps: RouteDeps, request: RouteRequest) => Promise<RouteAnswer>;

/** The config file as it is on disk now: what the editor opens on. */
const handleConfigFile: Handler = async ({ configPath }, request) => {
  if (request.method === "GET") {
    return ok({ path: configPath, ...readEditableFile(configPath) });
  }
  if (request.method !== "PUT") return notAllowed();
  const payload = (await request.readJson()) as {
    source?: unknown;
    expectedSource?: unknown;
  } | null;
  if (typeof payload?.source !== "string") {
    return bad("source must be a string");
  }
  if (typeof payload.expectedSource !== "string") {
    return bad("expectedSource must be the text the editor opened on");
  }
  const result = await saveEditableFile({
    path: configPath,
    source: payload.source,
    expectedSource: payload.expectedSource,
    validate: validateConfigSource,
  });
  if (result.status === "invalid") return bad(result.error);
  if (result.status === "conflict") {
    return { status: 409, body: { conflict: { source: result.source } } };
  }
  return ok({
    path: configPath,
    source: result.source,
    exists: true,
    warnings: result.warnings,
  });
};

/** Whether a repository has a checkout to read a diff from, before any diff is asked for. */
const handleConfigRepo: Handler = async ({ configPath }, request) => {
  if (request.method !== "GET") return notAllowed();
  const repo = request.query.get("repo") ?? "";
  if (!/^[^/\s]+\/[^/\s]+$/.test(repo)) return bad("repo must be owner/repo");
  return ok(await describeRepoAttachment(configPath, repo));
};

const handlePrDetail: Handler = async ({ transport, operations }, request) => {
  if (request.method !== "GET") return notAllowed();
  const read = readRef(request);
  if (isAnswer(read)) return read;
  const part = request.query.get("part");
  if (!isPullRequestPart(part)) return bad(`unknown part ${String(part)}`);
  return ok(await operations.fetchPullRequestPart(transport, read.ref, part));
};

const handlePrCandidates: Handler = async (
  { transport, operations },
  request,
) => {
  if (request.method !== "GET") return notAllowed();
  const read = readRef(request);
  if (isAnswer(read)) return read;
  return ok(await operations.fetchPullRequestCandidates(transport, read.ref));
};

const handlePrRevisions: Handler = async (
  { transport, operations },
  request,
) => {
  if (request.method !== "GET") return notAllowed();
  const read = readRef(request);
  if (isAnswer(read)) return read;
  const subjectId = request.query.get("subject") ?? "";
  if (subjectId === "") return bad("subject must be a node id");
  return ok(await operations.fetchPullRequestRevisions(transport, subjectId));
};

const handlePrEdit: Handler = async ({ transport, operations }, request) => {
  if (request.method !== "POST") return notAllowed();
  const payload =
    (await request.readJson()) as Partial<EditPullRequestRequest> | null;
  const ref = pullRequestRefOf(payload?.ownerRepo, payload?.number);
  if (typeof ref === "string") return bad(ref);
  const edit = operations.parsePullRequestEdit(payload?.edit);
  if (typeof edit === "string") return bad(edit);
  const followUpError = await operations.editPullRequest(transport, {
    ...ref,
    edit,
  });
  const body: EditPullRequestResponse = { edited: edit.kind, followUpError };
  return ok(body);
};

/**
 * The lines of a streamed diff: a `{ step }` line for each progress report of
 * `run`, then exactly one terminal line, `run`'s own (`{ result }` or
 * `{ refused }`) or `{ error }` when it threw. A long fetch takes tens of
 * seconds, which the reader would otherwise wait out with no sign of life.
 */
async function* streamLines(
  run: (onStep: (step: DiffStep) => void) => Promise<object>,
): AsyncGenerator<object> {
  const pending: object[] = [];
  const state: { finished: boolean; wake: (() => void) | null } = {
    finished: false,
    wake: null,
  };
  const notify = (): void => {
    state.wake?.();
    state.wake = null;
  };
  const task = run((step) => {
    pending.push({ step });
    notify();
  })
    .then(
      (last) => {
        pending.push(last);
      },
      (error: unknown) => {
        pending.push({ error: errorMessage(error) });
      },
    )
    .finally(() => {
      state.finished = true;
      notify();
    });
  for (;;) {
    while (pending.length > 0) yield pending.shift()!;
    if (state.finished) break;
    await new Promise<void>((resolve) => {
      state.wake = resolve;
    });
  }
  await task;
}

const handlePrDiff: Handler = async (
  { transport, operations, configPath },
  request,
) => {
  if (request.method !== "GET") return notAllowed();
  const read = readRef(request);
  if (isAnswer(read)) return read;
  const { ref } = read;
  const whitespace = request.query.get("whitespace") ?? "show";
  if (!isDiffWhitespace(whitespace)) {
    return bad("whitespace must be hide or show");
  }
  const head = request.query.get("head") ?? "";
  const base = request.query.get("base") ?? "";
  if (!isSha(head) || !isSha(base)) {
    return bad("head and base must be commit shas");
  }

  // no clone and no API diff for a repository the user did not point at
  const resolved = await resolveCheckout(configPath, ref.ownerRepo);
  if ("refused" in resolved) {
    return request.query.get("stream") === "1"
      ? {
          status: 200,
          body: null,
          lines: streamLines(() => Promise.resolve(resolved)),
        }
      : ok(resolved);
  }
  const readDiff = (
    onStep?: (step: DiffStep) => void,
  ): Promise<PullRequestDiffResponse> =>
    operations.readPullRequestDiff({
      checkout: resolved.checkout,
      transport,
      ref,
      head,
      base,
      whitespace,
      ...(onStep === undefined ? {} : { onStep }),
      ...(request.signal === undefined ? {} : { signal: request.signal }),
    });
  if (request.query.get("stream") === "1") {
    return {
      status: 200,
      body: null,
      lines: streamLines(async (onStep) => ({
        result: await readDiff(onStep),
      })),
    };
  }
  return ok(await readDiff());
};

const handlePrFile: Handler = async ({ operations, configPath }, request) => {
  if (request.method !== "GET") return notAllowed();
  const read = readRef(request);
  if (isAnswer(read)) return read;
  const sha = request.query.get("sha") ?? "";
  const path = request.query.get("path") ?? "";
  if (!isSha(sha)) return bad("sha must be a commit sha");
  if (path === "") return bad("path is required");
  const resolved = await resolveCheckout(configPath, read.ref.ownerRepo);
  if ("refused" in resolved) return bad(resolved.refused.detail);
  const body: PullRequestFileContentsResponse = {
    contents: await operations.readFileAtSha(resolved.checkout, sha, path),
  };
  return ok(body);
};

const handlePrReadingOrder: Handler = async (
  { operations, configPath },
  request,
) => {
  if (request.method !== "GET") return notAllowed();
  const read = readRef(request);
  if (isAnswer(read)) return read;
  const head = request.query.get("head") ?? "";
  const base = request.query.get("base") ?? "";
  if (!isSha(head) || !isSha(base)) {
    return bad("head and base must be commit shas");
  }
  const resolved = await resolveCheckout(configPath, read.ref.ownerRepo);
  if ("refused" in resolved) return ok(resolved);
  return ok(
    await operations.readReadingOrder({
      checkout: resolved.checkout,
      head,
      base,
    }),
  );
};

const handlePrImpacts: Handler = async (
  { operations, configPath },
  request,
) => {
  if (request.method !== "GET") return notAllowed();
  const read = readRef(request);
  if (isAnswer(read)) return read;
  const head = request.query.get("head") ?? "";
  const base = request.query.get("base") ?? "";
  if (!isSha(head) || !isSha(base)) {
    return bad("head and base must be commit shas");
  }
  const resolved = await resolveCheckout(configPath, read.ref.ownerRepo);
  if ("refused" in resolved) return ok(resolved);
  return ok(
    await operations.readImpacts({
      checkout: resolved.checkout,
      head,
      base,
    }),
  );
};

const handleReviewflowStatus: Handler = ({ reviewflow }, request) =>
  Promise.resolve(
    request.method === "GET" ? ok(reviewflow.status()) : notAllowed(),
  );

/** the credentials file is reported, never replaced: 409 says why nothing was stored */
const credentialsFailure = (error: unknown): RouteAnswer | null =>
  (error as { code?: string }).code === credentialsUnreadableCode
    ? { status: 409, body: { error: errorMessage(error) } }
    : null;

const handleReviewflowToken: Handler = async ({ reviewflow }, request) => {
  try {
    if (request.method === "DELETE") return ok(reviewflow.clearToken());
    if (request.method !== "PUT") return notAllowed();
    const payload =
      (await request.readJson()) as Partial<SetReviewflowTokenRequest> | null;
    if (typeof payload?.url !== "string" || payload.url.trim() === "") {
      return bad("url is required");
    }
    if (typeof payload.token !== "string" || payload.token.trim() === "") {
      return bad("token must be a non-empty string");
    }
    return ok(
      await reviewflow.setToken({ url: payload.url, token: payload.token }),
    );
  } catch (error) {
    if ((error as { code?: string }).code === tokenRefusedCode) {
      return bad(errorMessage(error));
    }
    const failure = credentialsFailure(error);
    if (failure !== null) return failure;
    throw error;
  }
};

const handleReviewflowBoard: Handler = async ({ reviewflow }, request) => {
  if (request.method !== "GET") return notAllowed();
  try {
    return ok(await reviewflow.board(request.query.get("refresh") === "1"));
  } catch (error) {
    return (
      credentialsFailure(error) ?? {
        status: 502,
        body: { error: errorMessage(error) },
      }
    );
  }
};

const handleReviewflowPr: Handler = async ({ reviewflow }, request) => {
  if (request.method !== "GET") return notAllowed();
  const read = readRef(request);
  if (isAnswer(read)) return read;
  try {
    return ok(await reviewflow.pr(read.ref));
  } catch (error) {
    return (
      credentialsFailure(error) ?? {
        status: 502,
        body: { error: errorMessage(error) },
      }
    );
  }
};

const handleEvents: Handler = ({ reviewflow }, request) =>
  Promise.resolve(
    request.method === "GET"
      ? { status: 200, body: null, events: reviewflow.subscribe }
      : notAllowed(),
  );

const handlers: Record<string, Handler> = {
  [apiRoutes.configFile]: handleConfigFile,
  [apiRoutes.configRepo]: handleConfigRepo,
  [apiRoutes.prDetail]: handlePrDetail,
  [apiRoutes.prCandidates]: handlePrCandidates,
  [apiRoutes.prRevisions]: handlePrRevisions,
  [apiRoutes.prEdit]: handlePrEdit,
  [apiRoutes.prDiff]: handlePrDiff,
  [apiRoutes.prFile]: handlePrFile,
  [apiRoutes.prReadingOrder]: handlePrReadingOrder,
  [apiRoutes.prImpacts]: handlePrImpacts,
  [apiRoutes.reviewflowStatus]: handleReviewflowStatus,
  [apiRoutes.reviewflowToken]: handleReviewflowToken,
  [apiRoutes.reviewflowBoard]: handleReviewflowBoard,
  [apiRoutes.reviewflowPr]: handleReviewflowPr,
  [apiRoutes.events]: handleEvents,
};

/** null when the path is not an api route the server serves. */
export const routeApiRequest = (
  deps: RouteDeps,
  request: RouteRequest,
): Promise<RouteAnswer> | null => {
  if (!Object.hasOwn(handlers, request.pathname)) return null;
  return handlers[request.pathname]!(deps, request);
};
