import { serverBaseUrl } from "./serverBaseUrl.ts";

const url = (path: string, query?: Record<string, string>): string => {
  const search = query === undefined ? "" : `?${new URLSearchParams(query)}`;
  return `${serverBaseUrl()}${path}${search}`;
};

const unreachable = (error: unknown): Error =>
  new Error(
    `cannot reach the reviewflow app server at ${serverBaseUrl()} (${
      error instanceof Error ? error.message : String(error)
    }). Is it running?`,
    { cause: error },
  );

/** the server's `{ error }` when it sent one, the status line otherwise */
const failureOf = async (response: Response): Promise<Error> => {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string") return new Error(body.error);
  } catch {
    // not json: the status says it
  }
  return new Error(`${response.status} ${response.statusText}`.trim());
};

const send = async (
  path: string,
  init: RequestInit | undefined,
  query?: Record<string, string>,
): Promise<Response> => {
  let response: Response;
  try {
    response = await fetch(url(path, query), init);
  } catch (error) {
    if (init?.signal?.aborted) throw error;
    throw unreachable(error);
  }
  if (!response.ok) throw await failureOf(response);
  return response;
};

export const getJson = async <T>(
  path: string,
  query?: Record<string, string>,
  signal?: AbortSignal,
): Promise<T> => {
  const response = await send(path, signal ? { signal } : undefined, query);
  return (await response.json()) as T;
};

export const postJson = async <T>(path: string, body: unknown): Promise<T> => {
  const response = await send(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await response.json()) as T;
};

/** A write with an optional json body; the server's refusal is the error, as sent. */
export const requestJson = async <T>(
  method: "DELETE" | "PUT",
  path: string,
  body?: unknown,
): Promise<T> => {
  const response = await send(path, {
    method,
    ...(body === undefined
      ? {}
      : {
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  return (await response.json()) as T;
};

/**
 * A write whose refusals are answers rather than failures: resolves with the
 * status and the json body whatever the status, so the caller reads a 409 or a
 * 400 as data. Only an unreachable server throws.
 */
export const requestAnswer = async (
  method: "PUT",
  path: string,
  body: unknown,
): Promise<{ status: number; body: unknown }> => {
  let response: Response;
  try {
    response = await fetch(url(path), {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw unreachable(error);
  }
  let answer: unknown = null;
  try {
    answer = await response.json();
  } catch {
    // not json: the status says it
  }
  return { status: response.status, body: answer };
};

/**
 * The lines of an `application/x-ndjson` answer, as they arrive. A runtime
 * whose fetch does not stream (react-native) delivers them all at the end.
 */
export async function* getNdjson(
  path: string,
  query: Record<string, string>,
  signal?: AbortSignal,
): AsyncGenerator<unknown> {
  const response = await send(path, signal ? { signal } : undefined, query);
  const parse = (line: string): unknown => JSON.parse(line) as unknown;
  if (response.body === null) {
    const text = await response.text();
    for (const line of text.split("\n")) {
      if (line.trim() !== "") yield parse(line);
    }
    return;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffered = "";
  for (;;) {
    const { done, value } = await reader.read();
    buffered += decoder.decode(value, { stream: !done });
    let newline = buffered.indexOf("\n");
    while (newline !== -1) {
      const line = buffered.slice(0, newline);
      buffered = buffered.slice(newline + 1);
      if (line.trim() !== "") yield parse(line);
      newline = buffered.indexOf("\n");
    }
    if (done) break;
  }
  if (buffered.trim() !== "") yield parse(buffered);
}
