import { beforeEach, describe, expect, it, vi } from "vitest";
import cookieParser from "cookie-parser";
import express from "express";
import type { MongoStores, OrgMember } from "reviewflow-core";
import { authCookieName, signAuthCookie } from "../auth/authCookie.ts";
import { callApp } from "../tests/callRouter.ts";
import slackConnect from "./slack-connect.ts";

vi.mock("../botApi.ts", () => ({
  callBotApi: vi.fn(() => Promise.resolve()),
  callBotApiBestEffort: vi.fn(() => Promise.resolve()),
}));

const userAgent = "vitest";
const userId = 42;
const orgId = 7;

const partialUpdateOne = vi.fn(() => Promise.resolve());

const createApp = ({
  orgMember,
}: {
  orgMember?: Partial<OrgMember>;
}): express.Express => {
  const mongoStores = {
    orgs: {
      findByKey: () =>
        Promise.resolve({ _id: orgId, login: "acme", slackTeamId: "T1" }),
      partialUpdateOne,
    },
    orgMembers: {
      findOne: () => Promise.resolve(orgMember),
      partialUpdateMany: vi.fn(() => Promise.resolve()),
    },
  } as unknown as MongoStores;

  const app = express();
  app.use(cookieParser());
  const router = express.Router();
  slackConnect(router, mongoStores);
  app.use("/app", router);

  return app;
};

const authenticatedHeaders = async (): Promise<Record<string, string>> => {
  const token = await signAuthCookie(
    { id: userId, login: "someone", accessToken: "gh-token", time: 0 },
    userAgent,
  );
  return {
    "user-agent": userAgent,
    cookie: `${authCookieName}=${token}`,
    host: "localhost:3000",
  };
};

const notAMember = "You+are+not+a+member+of+this+organization.";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("membership", () => {
  it("refuses to start the slack install for an org the user is not in", async () => {
    const app = createApp({ orgMember: undefined });

    const response = await callApp(app, {
      method: "GET",
      url: `/app/slack-install?orgId=${orgId}&orgLogin=acme`,
      headers: await authenticatedHeaders(),
    });

    expect(response.location).toBe(
      `http://localhost:8081/?error=${notAMember}`,
    );
  });

  it("refuses to start the slack login for an org the user is not in", async () => {
    const app = createApp({ orgMember: undefined });

    const response = await callApp(app, {
      method: "GET",
      url: `/app/slack-connect?orgId=${orgId}&orgLogin=acme`,
      headers: await authenticatedHeaders(),
    });

    expect(response.location).toBe(
      `http://localhost:8081/?error=${notAMember}`,
    );
  });

  it("redirects to slack when the user belongs to the org", async () => {
    const app = createApp({ orgMember: { _id: `${orgId}_${userId}` } });

    const response = await callApp(app, {
      method: "GET",
      url: `/app/slack-install?orgId=${orgId}&orgLogin=acme`,
      headers: await authenticatedHeaders(),
    });

    expect(response.location).toMatch(/^https:\/\/slack\.com\/oauth\/v2\//);
  });

  it("never links a slack workspace to an org the state points at without membership", async () => {
    const app = createApp({ orgMember: undefined });
    const state = encodeURIComponent(
      JSON.stringify({ orgId, orgLogin: "acme", isInstall: true }),
    );

    const response = await callApp(app, {
      method: "GET",
      url: `/app/slack-connect-response?code=oauth-code&state=${state}`,
      headers: await authenticatedHeaders(),
    });

    expect(response.location).toBe(
      `http://localhost:8081/?error=${notAMember}`,
    );
    expect(partialUpdateOne).not.toHaveBeenCalled();
  });

  it("redirects to the login when there is no auth cookie", async () => {
    const app = createApp({ orgMember: { _id: `${orgId}_${userId}` } });

    const response = await callApp(app, {
      method: "GET",
      url: `/app/slack-install?orgId=${orgId}&orgLogin=acme`,
      headers: { "user-agent": userAgent, host: "localhost:3000" },
    });

    expect(response.location).toBe("/app/login");
  });
});
