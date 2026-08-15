import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import type { Express } from "express";

interface CallOptions {
  method: "GET" | "POST";
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
}

interface CallResult {
  status: number;
  body: unknown;
}

/**
 * Drives an express app without opening a socket: the sandbox tests run in
 * cannot listen, and a route is worth testing through the real middleware chain
 * rather than by calling its handler directly.
 */
export const callApp = async (
  app: Express,
  { method, url, headers = {}, body }: CallOptions,
): Promise<CallResult> => {
  const payload = body === undefined ? undefined : JSON.stringify(body);

  const request = new IncomingMessage(new Socket());
  request.method = method;
  request.url = url;
  request.headers = {
    ...(payload === undefined
      ? {}
      : {
          "content-type": "application/json",
          "content-length": String(Buffer.byteLength(payload)),
        }),
    ...headers,
  };
  if (payload !== undefined) request.push(payload);
  request.push(null);

  const response = new ServerResponse(request);
  const chunks: Buffer[] = [];

  response.write = ((chunk: unknown): boolean => {
    if (chunk) chunks.push(Buffer.from(chunk as Uint8Array));
    return true;
  }) as ServerResponse["write"];

  const finished = new Promise<void>((resolve) => {
    response.end = ((chunk?: unknown): ServerResponse => {
      if (chunk) chunks.push(Buffer.from(chunk as Uint8Array));
      resolve();
      return response;
    }) as ServerResponse["end"];
  });

  app(request, response);
  await finished;

  const raw = Buffer.concat(chunks).toString();

  return {
    status: response.statusCode,
    body: raw === "" ? undefined : JSON.parse(raw),
  };
};
