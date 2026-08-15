import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import type { Express } from "express";

interface CallOptions {
  method: "GET" | "POST";
  url: string;
  headers?: Record<string, string>;
}

interface CallResult {
  status: number;
  location: string | undefined;
}

/**
 * Drives an express app without opening a socket: the sandbox tests run in
 * cannot listen, and the oauth routes are worth testing through the real
 * middleware chain rather than by calling their handler directly.
 */
export const callApp = async (
  app: Express,
  { method, url, headers = {} }: CallOptions,
): Promise<CallResult> => {
  const request = new IncomingMessage(new Socket());
  request.method = method;
  request.url = url;
  request.headers = headers;
  request.push(null);

  const response = new ServerResponse(request);

  response.write = ((): boolean => true) as ServerResponse["write"];

  const finished = new Promise<void>((resolve) => {
    response.end = ((): ServerResponse => {
      resolve();
      return response;
    }) as ServerResponse["end"];
  });

  app(request, response);
  await finished;

  const location = response.getHeader("location");

  return {
    status: response.statusCode,
    location: typeof location === "string" ? location : undefined,
  };
};
