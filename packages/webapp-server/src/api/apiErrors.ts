import type { ErrorRequestHandler, Response } from "express";
import { sendJsonWithoutEtag } from "./sendJsonWithoutEtag.ts";

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
  if (error instanceof ApiError) {
    if (error.retryAfterSeconds !== undefined) {
      res.setHeader("Retry-After", String(error.retryAfterSeconds));
    }
    sendApiError(res, error.code, error.message);
    return;
  }

  console.error("Unexpected api error", error);
  sendApiError(res, "internal", "Unexpected error");
};
