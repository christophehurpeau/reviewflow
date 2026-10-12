import type { ErrorRequestHandler, Response } from "express";

export type ApiErrorCode =
  | "forbidden"
  | "internal"
  | "notFound"
  | "rateLimited"
  | "unauthenticated";

const statusByCode: Record<ApiErrorCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  notFound: 404,
  rateLimited: 429,
  internal: 500,
};

export class ApiError extends Error {
  readonly code: ApiErrorCode;

  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}

export const sendApiError = (
  res: Response,
  code: ApiErrorCode,
  message: string,
): void => {
  res.status(statusByCode[code]).json({ error: { code, message } });
};

/** every failure answers the documented envelope, never express's html page */
export const apiErrorHandler: ErrorRequestHandler = (
  error: unknown,
  req,
  res,
  next,
) => {
  if (error instanceof ApiError) {
    sendApiError(res, error.code, error.message);
    return;
  }

  console.error("Unexpected api error", error);
  sendApiError(res, "internal", "Unexpected error");
};
