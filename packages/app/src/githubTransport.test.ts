/* oxlint-disable typescript/require-await */
import { describe, expect, test, vi } from "vitest";
import { createAuthenticatedSend } from "./githubTransport.ts";

const request = {
  method: "GET",
  path: "user",
  accept: "x",
  body: undefined,
} as const;

describe("createAuthenticatedSend", () => {
  test("reads the token once and reuses it", async () => {
    const readToken = vi.fn(async () => "t1");
    const sendRaw = vi.fn(async () => ({ status: 200, body: "{}" }));
    const send = createAuthenticatedSend({ readToken, sendRaw });
    await send(request);
    await send(request);
    expect(readToken).toHaveBeenCalledTimes(1);
    expect(sendRaw).toHaveBeenCalledWith(request, "t1");
  });

  test("re-reads the token after a 401 and retries once", async () => {
    const tokens = ["old", "new"];
    const readToken = vi.fn(async () => tokens.shift()!);
    const sendRaw = vi.fn(async (_r: unknown, token: string) =>
      token === "old" ? { status: 401, body: "" } : { status: 200, body: "ok" },
    );
    const send = createAuthenticatedSend({ readToken, sendRaw });
    expect(await send(request)).toEqual({ status: 200, body: "ok" });
    expect(readToken).toHaveBeenCalledTimes(2);
  });

  test("does not remember a failed read", async () => {
    const readToken = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("no token"))
      .mockResolvedValue("t");
    const send = createAuthenticatedSend({
      readToken,
      sendRaw: async () => ({ status: 200, body: "" }),
    });
    await expect(send(request)).rejects.toThrow("no token");
    await expect(send(request)).resolves.toEqual({ status: 200, body: "" });
  });
});
