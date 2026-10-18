import type http from "node:http";
import { describe, expect, it } from "vitest";
import type { AuthInfo } from "../auth/authCookie.ts";
import {
  authCookieName,
  signAuthCookie,
  signAuthToken,
  vscodeUserAgent,
} from "../auth/authCookie.ts";
import { getAuthenticatedUser } from "./getAuthenticatedUser.ts";

const userAgent = "vitest";

const authInfo: AuthInfo = {
  id: 42,
  login: "someone",
  accessToken: "gh-token",
  time: 0,
};

const createRequest = (
  headers: Partial<http.IncomingHttpHeaders>,
): http.IncomingMessage => {
  const request: Pick<http.IncomingMessage, "headers"> = {
    headers: { host: "localhost:3000", "user-agent": userAgent, ...headers },
  };
  return request as http.IncomingMessage;
};

describe("getAuthenticatedUser", () => {
  it("returns the user of a valid cookie", async () => {
    const token = await signAuthCookie(authInfo, userAgent);

    await expect(
      getAuthenticatedUser(
        createRequest({ cookie: `${authCookieName}=${token}` }),
      ),
    ).resolves.toEqual({
      id: 42,
      login: "someone",
      accessToken: "gh-token",
      isEditorSession: false,
    });
  });

  it("marks a session of the editor extension", async () => {
    const token = await signAuthToken(authInfo, vscodeUserAgent);

    await expect(
      getAuthenticatedUser(
        createRequest({
          cookie: `${authCookieName}=${token}`,
          "user-agent": vscodeUserAgent,
        }),
      ),
    ).resolves.toMatchObject({ id: 42, isEditorSession: true });
  });

  it("returns null without a cookie", async () => {
    await expect(getAuthenticatedUser(createRequest({}))).resolves.toBeNull();
  });

  it("returns null for a tampered cookie", async () => {
    await expect(
      getAuthenticatedUser(
        createRequest({ cookie: `${authCookieName}=not-a-jwt` }),
      ),
    ).resolves.toBeNull();
  });

  it("returns null when the cookie was signed for another user agent", async () => {
    const token = await signAuthCookie(authInfo, "another-browser");

    await expect(
      getAuthenticatedUser(
        createRequest({ cookie: `${authCookieName}=${token}` }),
      ),
    ).resolves.toBeNull();
  });

  it("rejects a handshake coming from another origin", async () => {
    const token = await signAuthCookie(authInfo, userAgent);

    await expect(
      getAuthenticatedUser(
        createRequest({
          cookie: `${authCookieName}=${token}`,
          origin: "http://evil.example.com",
        }),
      ),
    ).resolves.toBeNull();
  });

  it("accepts a handshake coming from the webapp origin", async () => {
    const token = await signAuthCookie(authInfo, userAgent);

    await expect(
      getAuthenticatedUser(
        createRequest({
          cookie: `${authCookieName}=${token}`,
          origin: "http://localhost:8081",
        }),
      ),
    ).resolves.toMatchObject({ id: 42, login: "someone" });
  });
});
