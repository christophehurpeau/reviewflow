import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { createServer } from "node:http";
import { errorMessage, log } from "./log.ts";
import { bodyTooLargeCode, readBody } from "./readBody.ts";
import { judgeRequest } from "./requestGuard.ts";
import type { RouteDeps } from "./routes.ts";
import { routeApiRequest } from "./routes.ts";
import { serveStatic } from "./static.ts";

export interface AppServerOptions extends RouteDeps {
  distDirectory: string;
  /** trust the expo dev server's origins (`REVIEWFLOW_APP_DEV=1`) */
  allowDevOrigins?: boolean;
}

const preflightMaxAgeSeconds = 600;

const writeJson = (
  response: ServerResponse,
  status: number,
  body: unknown,
): void => {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
};

export const handleRequest = async (
  options: AppServerOptions,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> => {
  const method = request.method ?? "GET";
  const url = new URL(request.url ?? "/", "http://localhost");

  const secFetchSite = request.headers["sec-fetch-site"];
  const verdict = judgeRequest({
    host: request.headers.host,
    origin: request.headers.origin,
    secFetchSite: typeof secFetchSite === "string" ? secFetchSite : undefined,
    api: url.pathname.startsWith("/api/"),
    allowDevOrigins: options.allowDevOrigins === true,
  });
  if (!verdict.allowed) {
    log("warn", "request refused", {
      method,
      path: url.pathname,
      reason: verdict.reason,
    });
    writeJson(response, 403, { error: verdict.reason });
    return;
  }
  // only an allowed origin is echoed, never `*`
  if (verdict.corsOrigin !== null) {
    response.setHeader("access-control-allow-origin", verdict.corsOrigin);
    response.setHeader("vary", "origin");
  }

  if (method === "OPTIONS") {
    response.writeHead(204, {
      "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
      "access-control-allow-headers": "content-type",
      "access-control-max-age": String(preflightMaxAgeSeconds),
    });
    response.end();
    return;
  }

  const clientGone = new AbortController();
  response.on("close", () => {
    if (!response.writableFinished) clientGone.abort();
  });

  try {
    const routed = routeApiRequest(options, {
      method,
      pathname: url.pathname,
      query: url.searchParams,
      signal: clientGone.signal,
      readJson: async () => {
        try {
          return JSON.parse(await readBody(request)) as unknown;
        } catch (error) {
          if ((error as { code?: string }).code === bodyTooLargeCode) {
            throw error;
          }
          throw new Error("body is not json", { cause: error });
        }
      },
    });
    if (routed !== null) {
      const answer = await routed;
      if (answer.events !== undefined) {
        response.writeHead(answer.status, {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-store",
          "x-accel-buffering": "no",
        });
        // flushes the headers so the browser's EventSource opens at once
        response.write(": open\n\n");
        const unsubscribe = answer.events((chunk) => response.write(chunk));
        response.on("close", unsubscribe);
        return;
      }
      if (answer.lines !== undefined) {
        response.writeHead(answer.status, {
          "content-type": "application/x-ndjson; charset=utf-8",
          "cache-control": "no-store",
          "x-accel-buffering": "no",
        });
        for await (const line of answer.lines) {
          if (clientGone.signal.aborted) continue;
          response.write(`${JSON.stringify(line)}\n`);
        }
        response.end();
        return;
      }
      writeJson(response, answer.status, answer.body);
      if (answer.status >= 400) {
        log("warn", "request failed", {
          method,
          path: url.pathname,
          status: answer.status,
          error: (answer.body as { error?: string }).error,
        });
      }
      return;
    }

    if (url.pathname.startsWith("/api/")) {
      writeJson(response, 404, { error: "not found" });
      return;
    }
    if (method !== "GET" && method !== "HEAD") {
      writeJson(response, 405, { error: "method not allowed" });
      return;
    }
    const answer = await serveStatic(options.distDirectory, url.pathname);
    response.writeHead(answer.status, { "content-type": answer.contentType });
    response.end(method === "HEAD" ? undefined : answer.body);
  } catch (error) {
    const tooLarge = (error as { code?: string }).code === bodyTooLargeCode;
    let status = 500;
    if (tooLarge) status = 413;
    else if (errorMessage(error) === "body is not json") status = 400;
    log("error", "request failed", {
      method,
      path: url.pathname,
      status,
      error: errorMessage(error),
    });
    if (!response.headersSent) {
      writeJson(response, status, { error: errorMessage(error) });
    } else {
      response.end();
    }
  }
};

/** Not bound: the caller listens, so tests never take a port. */
export const createAppServer = (options: AppServerOptions): Server =>
  createServer((request, response) => {
    handleRequest(options, request, response).catch((error: unknown) => {
      log("error", "request crashed", { error: errorMessage(error) });
      response.destroy();
    });
  });
