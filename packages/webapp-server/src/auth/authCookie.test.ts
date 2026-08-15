import { describe, expect, it } from "vitest";
import type { AuthInfo } from "./authCookie.ts";
import { signAuthCookie, verifyAuthCookie } from "./authCookie.ts";

const authInfo: AuthInfo = {
  id: 42,
  login: "someone",
  accessToken: "gh-token",
  time: 0,
};

describe("verifyAuthCookie", () => {
  it("returns the auth info when the user agent matches", async () => {
    const token = await signAuthCookie(authInfo, "vitest");

    await expect(verifyAuthCookie(token, "vitest")).resolves.toMatchObject({
      id: 42,
      login: "someone",
    });
  });

  it("rejects a cookie replayed without a user agent", async () => {
    const token = await signAuthCookie(authInfo, "vitest");

    await expect(verifyAuthCookie(token, undefined)).resolves.toBeUndefined();
    await expect(verifyAuthCookie(token, "")).resolves.toBeUndefined();
  });

  it("rejects a cookie signed without a user agent but replayed with one", async () => {
    const token = await signAuthCookie(authInfo, undefined);

    await expect(verifyAuthCookie(token, "vitest")).resolves.toBeUndefined();
    await expect(verifyAuthCookie(token, undefined)).resolves.toMatchObject({
      id: 42,
    });
  });
});
