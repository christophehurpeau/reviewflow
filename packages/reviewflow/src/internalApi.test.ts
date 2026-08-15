import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Probot } from "probot";
import type { AppContext } from "./context/AppContext.ts";
import { getExistingAccountContext } from "./context/accountContext.ts";
import { syncOrg } from "./events/account-handlers/actions/syncOrg.ts";
import { syncTeamsAndTeamMembers } from "./events/account-handlers/actions/syncTeams.ts";
import { syncUser } from "./events/account-handlers/actions/syncUser.ts";
import internalApiRouter from "./internalApi.ts";
import { callApp } from "./tests/callRouter.ts";

vi.mock("./context/accountContext.ts", () => ({
  getExistingAccountContext: vi.fn(() => null),
}));
vi.mock("./events/account-handlers/actions/syncOrg.ts", () => ({
  syncOrg: vi.fn(() => Promise.resolve()),
}));
vi.mock("./events/account-handlers/actions/syncTeams.ts", () => ({
  syncTeamsAndTeamMembers: vi.fn(() => Promise.resolve()),
}));
vi.mock("./events/account-handlers/actions/syncUser.ts", () => ({
  syncUser: vi.fn(() => Promise.resolve()),
}));

const secret = "internal-secret";
const authorized = { authorization: `Bearer ${secret}` };

const installationOctokit = {
  rest: { name: "rest" },
  paginate: { name: "paginate" },
};

interface Harness {
  app: express.Express;
  auth: ReturnType<typeof vi.fn>;
}

const createApp = ({
  org,
  user,
}: {
  org?: unknown;
  user?: unknown;
} = {}): Harness => {
  const auth = vi.fn(() => Promise.resolve(installationOctokit));

  const appContext = {
    mongoStores: {
      orgs: { findByKey: () => Promise.resolve(org) },
      users: { findByKey: () => Promise.resolve(user) },
    },
  } as unknown as AppContext;

  const app = express();
  app.use(
    "/api/internal",
    internalApiRouter({ auth } as unknown as Probot, appContext),
  );

  return { app, auth };
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("INTERNAL_API_SECRET", secret);
  vi.mocked(getExistingAccountContext).mockReturnValue(null);
});

describe("secret", () => {
  it("refuses to build the router without the env variable", () => {
    vi.stubEnv("INTERNAL_API_SECRET", "");

    expect(() => createApp()).toThrow("Missing env variable");
  });

  it("rejects a request without an authorization header", async () => {
    const { app } = createApp();

    const response = await callApp(app, {
      method: "POST",
      url: "/api/internal/sync/org",
      body: { orgId: 1 },
    });

    expect(response.status).toBe(401);
  });

  it("rejects a wrong secret", async () => {
    const { app } = createApp();

    const response = await callApp(app, {
      method: "POST",
      url: "/api/internal/sync/org",
      headers: { authorization: "Bearer nope" },
      body: { orgId: 1 },
    });

    expect(response.status).toBe(401);
    expect(syncOrg).not.toHaveBeenCalled();
  });

  it("rejects a secret sharing the prefix but not the length", async () => {
    const { app } = createApp();

    const response = await callApp(app, {
      method: "POST",
      url: "/api/internal/sync/org",
      headers: { authorization: `Bearer ${secret}extra` },
      body: { orgId: 1 },
    });

    expect(response.status).toBe(401);
  });
});

describe("POST /sync/org", () => {
  it("rejects a missing orgId", async () => {
    const { app } = createApp();

    const response = await callApp(app, {
      method: "POST",
      url: "/api/internal/sync/org",
      headers: authorized,
      body: {},
    });

    expect(response.status).toBe(400);
  });

  it("answers not found for an unknown org", async () => {
    const { app } = createApp({ org: undefined });

    const response = await callApp(app, {
      method: "POST",
      url: "/api/internal/sync/org",
      headers: authorized,
      body: { orgId: 1 },
    });

    expect(response.status).toBe(404);
    expect(syncOrg).not.toHaveBeenCalled();
  });

  it("syncs with the installation octokit, not the caller's", async () => {
    const { app, auth } = createApp({
      org: { _id: 1, login: "acme", installationId: 77 },
    });

    const response = await callApp(app, {
      method: "POST",
      url: "/api/internal/sync/org",
      headers: authorized,
      body: { orgId: 1 },
    });

    expect(response.status).toBe(204);
    expect(auth).toHaveBeenCalledWith(77);
    expect(syncOrg).toHaveBeenCalledWith(
      expect.anything(),
      installationOctokit.rest,
      installationOctokit.paginate,
      77,
      { id: 1, login: "acme" },
    );
    expect(syncTeamsAndTeamMembers).toHaveBeenCalledWith(
      expect.anything(),
      installationOctokit.rest,
      installationOctokit.paginate,
      { id: 1, login: "acme" },
    );
  });

  it("refreshes the cached teams of the account context", async () => {
    const updateGithubTeamMembers = vi.fn(() => Promise.resolve());
    vi.mocked(getExistingAccountContext).mockReturnValue(
      Promise.resolve({ updateGithubTeamMembers }) as any,
    );
    const { app } = createApp({
      org: { _id: 1, login: "acme", installationId: 77 },
    });

    const response = await callApp(app, {
      method: "POST",
      url: "/api/internal/sync/org",
      headers: authorized,
      body: { orgId: 1 },
    });

    expect(response.status).toBe(204);
    expect(updateGithubTeamMembers).toHaveBeenCalled();
  });

  it("succeeds when the org has no cached account context", async () => {
    const { app } = createApp({
      org: { _id: 1, login: "acme", installationId: 77 },
    });

    const response = await callApp(app, {
      method: "POST",
      url: "/api/internal/sync/org",
      headers: authorized,
      body: { orgId: 1 },
    });

    expect(response.status).toBe(204);
    expect(syncOrg).toHaveBeenCalled();
  });
});

describe("POST /sync/user", () => {
  it("answers not found when reviewflow is not installed for the user", async () => {
    const { app } = createApp({ user: { _id: 42, login: "someone" } });

    const response = await callApp(app, {
      method: "POST",
      url: "/api/internal/sync/user",
      headers: authorized,
      body: { userId: 42 },
    });

    expect(response.status).toBe(404);
    expect(syncUser).not.toHaveBeenCalled();
  });

  it("syncs the user with its own installation", async () => {
    const { app, auth } = createApp({
      user: { _id: 42, login: "someone", installationId: 9 },
    });

    const response = await callApp(app, {
      method: "POST",
      url: "/api/internal/sync/user",
      headers: authorized,
      body: { userId: 42 },
    });

    expect(response.status).toBe(204);
    expect(auth).toHaveBeenCalledWith(9);
    expect(syncUser).toHaveBeenCalledWith(
      expect.anything(),
      installationOctokit.rest,
      9,
      {
        id: 42,
        login: "someone",
      },
    );
  });
});

describe("POST /slack/org-installed", () => {
  it("rejects an incomplete body", async () => {
    const { app } = createApp();

    const response = await callApp(app, {
      method: "POST",
      url: "/api/internal/slack/org-installed",
      headers: authorized,
      body: { orgId: 1 },
    });

    expect(response.status).toBe(400);
  });

  it("succeeds when no account context is cached yet", async () => {
    const { app } = createApp();

    const response = await callApp(app, {
      method: "POST",
      url: "/api/internal/slack/org-installed",
      headers: authorized,
      body: { orgId: 1, orgLogin: "acme" },
    });

    expect(response.status).toBe(204);
  });

  it("re-inits slack on the cached account context", async () => {
    const initSlack = vi.fn(() => Promise.resolve());
    vi.mocked(getExistingAccountContext).mockReturnValue(
      Promise.resolve({ initSlack }) as any,
    );
    const { app } = createApp();

    const response = await callApp(app, {
      method: "POST",
      url: "/api/internal/slack/org-installed",
      headers: authorized,
      body: { orgId: 1, orgLogin: "acme" },
    });

    expect(response.status).toBe(204);
    expect(getExistingAccountContext).toHaveBeenCalledWith({
      type: "Organization",
      id: 1,
      login: "acme",
    });
    expect(initSlack).toHaveBeenCalled();
  });
});

describe("POST /slack/member-linked", () => {
  it("updates the slack member on the cached account context", async () => {
    const updateSlackMember = vi.fn();
    vi.mocked(getExistingAccountContext).mockReturnValue(
      Promise.resolve({ slack: { updateSlackMember } }) as any,
    );
    const { app } = createApp();

    const response = await callApp(app, {
      method: "POST",
      url: "/api/internal/slack/member-linked",
      headers: authorized,
      body: { orgId: 1, orgLogin: "acme", userId: 42, userLogin: "someone" },
    });

    expect(response.status).toBe(204);
    expect(updateSlackMember).toHaveBeenCalledWith(42, "someone");
  });

  it("rejects a body missing the user", async () => {
    const { app } = createApp();

    const response = await callApp(app, {
      method: "POST",
      url: "/api/internal/slack/member-linked",
      headers: authorized,
      body: { orgId: 1, orgLogin: "acme" },
    });

    expect(response.status).toBe(400);
  });
});
