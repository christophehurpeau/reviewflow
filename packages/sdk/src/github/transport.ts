/**
 * How this package reaches GitHub, supplied by the app: the token, the HTTP
 * client and the identity the requests go out under are the app's, so the
 * same queries run from a local server with the user's `gh` login, or from
 * anywhere `fetch` exists.
 *
 * `createGitHubTransport` builds the three calls from one raw `send`; an app
 * only has to authenticate and carry the bytes.
 */

export interface HttpAnswer {
  status: number;
  body: string;
}

export type HttpMethod = "DELETE" | "GET" | "PATCH" | "POST" | "PUT";

export interface HttpRequest {
  method: HttpMethod;
  /** relative to the API root (`https://api.github.com/`), already encoded */
  path: string;
  accept: string;
  /** JSON, already serialized */
  body: string | undefined;
}

export type SendToGitHub = (request: HttpRequest) => Promise<HttpAnswer>;

export interface GhGraphqlResult<Data> {
  /** null when the whole query failed; partial when some aliases resolved */
  data: Data | null;
  errors: string[];
}

export type GhRestMethod = "DELETE" | "PATCH" | "POST" | "PUT";

export interface GitHubTransport {
  graphql: <Data>(
    query: string,
    variables?: Record<string, unknown>,
  ) => Promise<GhGraphqlResult<Data>>;
  rest: <Data>(request: {
    method: GhRestMethod;
    /** relative to the API root, already encoded */
    path: string;
    body?: unknown;
  }) => Promise<Data | null>;
  text: (request: {
    /** relative to the API root, already encoded */
    path: string;
    accept: string;
  }) => Promise<string>;
}

const firstLine = (text: string): string =>
  text.split("\n", 1)[0]?.trim() ?? "";

const isSuccess = (status: number): boolean => status >= 200 && status < 300;

const parseJson = <Value>(text: string): Value | null => {
  try {
    return JSON.parse(text) as Value;
  } catch {
    return null;
  }
};

/**
 * A GraphQL answer carrying an `errors` array next to usable `data` — one
 * repository the token cannot see — is a partial answer, not a failed request.
 * Only an answer with no `data` at all is raised: an expired token, a rate
 * limit or a network failure, which the user has to act on.
 */
export const interpretGraphql = <Data>({
  status,
  body,
}: HttpAnswer): GhGraphqlResult<Data> => {
  const parsed = parseJson<{
    data?: Data | null;
    errors?: { message?: string }[];
    message?: string;
  }>(body);

  if (parsed === null || (!isSuccess(status) && parsed.data == null)) {
    const detail = parsed?.message ?? firstLine(body);
    throw new Error(
      `GitHub graphql failed (HTTP ${String(status)})${detail === "" ? "" : `: ${detail}`}`,
    );
  }

  return {
    data: parsed.data ?? null,
    errors: (parsed.errors ?? []).map(
      ({ message }) => message ?? "github returned an unnamed error",
    ),
  };
};

interface GhRestError {
  message?: string;
  errors?: (string | { message?: string; code?: string; field?: string })[];
}

export const restErrorMessage = ({ status, body }: HttpAnswer): string => {
  const parsed = parseJson<GhRestError>(body);
  const details = (parsed?.errors ?? [])
    .map((error) =>
      typeof error === "string"
        ? error
        : (error.message ??
          [error.field, error.code].filter(Boolean).join(" ")),
    )
    .filter((detail) => detail !== "");
  const headline =
    parsed?.message ?? (firstLine(body) || `HTTP ${String(status)}`);
  return [headline, ...details].filter((part) => part !== "").join(": ");
};

/**
 * A REST write's non-2xx status is the answer: a write GitHub refused changed
 * nothing, so its message is raised as is. A text read (a unified diff, with
 * `Accept: application/vnd.github.diff`) is refused past 300 files or 20,000
 * lines with a 406, raised the same way.
 */
export const createGitHubTransport = (send: SendToGitHub): GitHubTransport => ({
  graphql: async <Data>(
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<GhGraphqlResult<Data>> =>
    interpretGraphql<Data>(
      await send({
        method: "POST",
        path: "graphql",
        accept: "application/json",
        body: JSON.stringify(
          variables === undefined ? { query } : { query, variables },
        ),
      }),
    ),
  rest: async <Data>({
    method,
    path,
    body,
  }: {
    method: GhRestMethod;
    path: string;
    body?: unknown;
  }): Promise<Data | null> => {
    const answer = await send({
      method,
      path,
      accept: "application/vnd.github+json",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!isSuccess(answer.status)) {
      throw new Error(
        `GitHub refused ${method} ${path}: ${restErrorMessage(answer)}`,
      );
    }
    return parseJson<Data>(answer.body);
  },
  text: async ({ path, accept }) => {
    const answer = await send({ method: "GET", path, accept, body: undefined });
    if (!isSuccess(answer.status)) {
      throw new Error(
        `GitHub refused GET ${path}: ${restErrorMessage(answer)}`,
      );
    }
    return answer.body;
  },
});
