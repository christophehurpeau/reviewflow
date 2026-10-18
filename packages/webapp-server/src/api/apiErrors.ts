import type { ErrorRequestHandler, Response } from "express";
import { Logger } from "nightingale-logger";
import { sendJsonWithoutEtag } from "./sendJsonWithoutEtag.ts";

const logger = new Logger("reviewflow:webapp-server:api");

export type ApiErrorCode =
  | "badRequest"
  | "forbidden"
  | "internal"
  | "notFound"
  | "rateLimited"
  | "unauthenticated"
  | "unavailable";

const statusByCode: Record<ApiErrorCode, number> = {
  badRequest: 400,
  unauthenticated: 401,
  forbidden: 403,
  notFound: 404,
  rateLimited: 429,
  internal: 500,
  unavailable: 503,
};

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly retryAfterSeconds?: number;

  constructor(code: ApiErrorCode, message: string, retryAfterSeconds?: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export const rateLimitedError = (retryAfterSeconds: number): ApiError =>
  new ApiError(
    "rateLimited",
    `Too many requests, retry in ${retryAfterSeconds}s`,
    retryAfterSeconds,
  );

export const sendApiError = (
  res: Response,
  code: ApiErrorCode,
  message: string,
): void => {
  res.status(statusByCode[code]);
  sendJsonWithoutEtag(res, { error: { code, message } });
};

/** every failure answers the documented envelope, never express's html page */
export const apiErrorHandler: ErrorRequestHandler = (
  error: unknown,
  req,
  res,
  next,
) => {
  // a started response, a stream, can only be cut: its own `close` cleans up
  if (res.headersSent) {
    logger.error("Api error after the response started", { error });
    res.destroy();
    return;
  }

  if (error instanceof ApiError) {
    if (error.retryAfterSeconds !== undefined) {
      res.setHeader("Retry-After", String(error.retryAfterSeconds));
    }
    sendApiError(res, error.code, error.message);
    return;
  }

  logger.error("Unexpected api error", { error });
  sendApiError(res, "internal", "Unexpected error");
};
