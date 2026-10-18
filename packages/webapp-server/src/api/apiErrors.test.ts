import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { ApiError, apiErrorHandler } from "./apiErrors.ts";

describe("apiErrorHandler", () => {
  it("cuts a response already started instead of answering the envelope", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const res = {
      headersSent: true,
      destroy: vi.fn(),
      status: vi.fn(),
      setHeader: vi.fn(),
    };
    const next = vi.fn();

    apiErrorHandler(
      new ApiError("internal", "failed mid-stream"),
      {} as Request,
      res as unknown as Response,
      next,
    );

    expect(res.destroy).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.setHeader).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
