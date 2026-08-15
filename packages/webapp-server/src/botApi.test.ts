import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResourcesServerError } from "liwi-resources-server";
import { callBotApi, callBotApiBestEffort } from "./botApi.ts";

const respond = (status: number, body?: unknown): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: () =>
      body === undefined
        ? Promise.reject(new Error("no body"))
        : Promise.resolve(body),
  }) as unknown as Response;

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("INTERNAL_API_SECRET", "internal-secret");
  vi.stubEnv("BOT_INTERNAL_URL", "");
});

describe("callBotApi", () => {
  it("posts the body to the webhook server with the shared secret", async () => {
    fetchMock.mockResolvedValue(respond(204));

    await callBotApi("/sync/org", { orgId: 1 });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:3002/api/internal/sync/org",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer internal-secret",
        },
        body: '{"orgId":1}',
      },
    );
  });

  it("ignores this process's own PORT when defaulting the bot url", async () => {
    vi.stubEnv("PORT", "3000");
    fetchMock.mockResolvedValue(respond(204));

    await callBotApi("/sync/org", { orgId: 1 });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:3002/api/internal/sync/org",
      expect.anything(),
    );
  });

  it("uses BOT_INTERNAL_URL when set, without a trailing slash", async () => {
    vi.stubEnv("BOT_INTERNAL_URL", "http://bot.internal:8080/");
    fetchMock.mockResolvedValue(respond(204));

    await callBotApi("/sync/user", { userId: 42 });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://bot.internal:8080/api/internal/sync/user",
      expect.anything(),
    );
  });

  it("refuses to call without the shared secret", async () => {
    vi.stubEnv("INTERNAL_API_SECRET", "");

    await expect(callBotApi("/sync/org", { orgId: 1 })).rejects.toThrow(
      "Missing env variable",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports the bot being unreachable rather than a generic failure", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(callBotApi("/sync/org", { orgId: 1 })).rejects.toMatchObject({
      code: "UNAVAILABLE",
    });
  });

  it("maps the bot status to a resources error code", async () => {
    fetchMock.mockResolvedValue(
      respond(404, { error: "Unknown organization" }),
    );

    const error = await callBotApi("/sync/org", { orgId: 1 }).catch(
      (error_: unknown) => error_,
    );

    expect(error).toBeInstanceOf(ResourcesServerError);
    expect(error).toMatchObject({
      code: "NOT_FOUND",
      message: "Unknown organization",
    });
  });

  it("maps a rejected secret to UNAUTHENTICATED", async () => {
    fetchMock.mockResolvedValue(
      respond(401, { error: "Invalid internal api secret" }),
    );

    await expect(callBotApi("/sync/org", { orgId: 1 })).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });

  it("falls back to UNEXPECTED_ERROR on an unmapped status without a body", async () => {
    fetchMock.mockResolvedValue(respond(500));

    await expect(callBotApi("/sync/org", { orgId: 1 })).rejects.toMatchObject({
      code: "UNEXPECTED_ERROR",
    });
  });
});

describe("callBotApiBestEffort", () => {
  it("swallows an unreachable bot so the oauth redirect still happens", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(
      callBotApiBestEffort("/slack/member-linked", { orgId: 1 }),
    ).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
  });

  it("swallows a rejected request too", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    fetchMock.mockResolvedValue(respond(401, { error: "nope" }));

    await expect(
      callBotApiBestEffort("/slack/org-installed", { orgId: 1 }),
    ).resolves.toBeUndefined();

    consoleError.mockRestore();
  });

  it("stays quiet when the bot accepts", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    fetchMock.mockResolvedValue(respond(204));

    await callBotApiBestEffort("/slack/org-installed", { orgId: 1 });

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
