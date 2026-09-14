import { describe, expect, it } from "vitest";
import type { AuthInfo } from "./authCookie.ts";
import {
  signAuthCookie,
  signAuthToken,
  verifyAuthCookie,
  vscodeUserAgent,
} from "./authCookie.ts";

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

describe("signAuthToken", () => {
  it("verifies against the editor's own user agent, which is the audience", async () => {
    const token = await signAuthToken(authInfo, vscodeUserAgent);

    await expect(
      verifyAuthCookie(token, vscodeUserAgent),
    ).resolves.toMatchObject({ id: 42, login: "someone" });
  });

  it("does not accept an editor token sent from a browser", async () => {
    const token = await signAuthToken(authInfo, vscodeUserAgent);

    await expect(
      verifyAuthCookie(token, "Mozilla/5.0"),
    ).resolves.toBeUndefined();
  });
});
