import { describe, expect, it } from "vitest";
import cookieParser from "cookie-parser";
import express from "express";
import { authCookieName, signAuthCookie } from "../auth/authCookie.ts";
import { callApp } from "../tests/callRouter.ts";
import legacyRedirects from "./legacy-redirects.ts";

const userAgent = "vitest";
const webappUrl = "http://localhost:8081";

const createApp = (): express.Express => {
  const app = express();
  app.use(cookieParser());
  const router = express.Router();
  legacyRedirects(router);
  app.use("/app", router);
  return app;
};

const authenticatedHeaders = async (
  login: string,
): Promise<Record<string, string>> => {
  const token = await signAuthCookie(
    { id: 42, login, accessToken: "gh-token", time: 0 },
    userAgent,
  );
  return {
    "user-agent": userAgent,
    cookie: `${authCookieName}=${token}`,
    host: "localhost:3000",
  };
};

describe("legacy /app redirects", () => {
  it.each([
    ["/app", "/"],
    ["/app/", "/"],
    ["/app/user", "/user"],
    ["/app/user/force-sync", "/user"],
    ["/app/repositories", "/user/repositories"],
    ["/app/org/acme", "/org/acme"],
    ["/app/org/acme/force-sync", "/org/acme"],
  ])("permanently redirects %s to the webapp %s", async (url, path) => {
    const response = await callApp(createApp(), { method: "GET", url });

    expect(response.status).toBe(301);
    expect(response.location).toBe(`${webappUrl}${path}`);
  });

  it("redirects a repository of the signed in user to their own account", async () => {
    const response = await callApp(createApp(), {
      method: "GET",
      url: "/app/repository/someone/reviewflow",
      headers: await authenticatedHeaders("Someone"),
    });

    expect(response.location).toBe(`${webappUrl}/user/repositories/reviewflow`);
  });

  it("redirects a repository of another owner to the organization", async () => {
    const response = await callApp(createApp(), {
      method: "GET",
      url: "/app/repository/acme/reviewflow",
      headers: await authenticatedHeaders("someone"),
    });

    expect(response.location).toBe(
      `${webappUrl}/org/acme/repositories/reviewflow`,
    );
  });

  it("redirects a repository to the organization when signed out", async () => {
    const response = await callApp(createApp(), {
      method: "GET",
      url: "/app/repository/acme/reviewflow",
    });

    expect(response.location).toBe(
      `${webappUrl}/org/acme/repositories/reviewflow`,
    );
  });
});
