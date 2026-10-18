import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MongoStores, Org } from "reviewflow-core";
import { callBotApiForJson } from "../botApi.ts";
import type { AuthenticatedWsUser } from "./getAuthenticatedUser.ts";
import type { MembershipScopes } from "./membershipScopes.ts";
import { createOrgsService } from "./orgsService.ts";

const scopes: MembershipScopes = { watch: () => () => {} };

vi.mock("../botApi.ts", () => ({
  callBotApi: vi.fn(),
  callBotApiForJson: vi.fn(),
}));

const loggedInUser: AuthenticatedWsUser = {
  id: 42,
  login: "christophehurpeau",
  accessToken: "gh-token",
};

const buildOrg = (
  config: Org["config"] | undefined,
  paidEnabled = false,
): Org =>
  ({
    _id: 1,
    login: "acme",
    status: "active",
    config,
    paidFeatures: paidEnabled ? { enabled: true } : undefined,
  }) as unknown as Org;

interface Stores {
  mongoStores: MongoStores;
  partialUpdateByKey: ReturnType<typeof vi.fn>;
  createQuerySingleItem: ReturnType<typeof vi.fn>;
  createQueryCollection: ReturnType<typeof vi.fn>;
}

/** the user is a member of org 1, and of nothing else */
const createStores = (isPaidEnabled = true): Stores => {
  const partialUpdateByKey = vi.fn(() => Promise.resolve());
  const createQuerySingleItem = vi.fn(() => "query");
  const createQueryCollection = vi.fn(() => "query");

  const mongoStores: any = {
    orgMembers: {
      findAll: () =>
        Promise.resolve([{ org: { id: 1, login: "acme" }, user: { id: 42 } }]),
      findOne: ({ "org.id": orgId }: Record<string, number>) =>
        Promise.resolve(
          orgId === 1
            ? { _id: "1_42", org: { id: 1, login: "acme" }, user: { id: 42 } }
            : null,
        ),
    },
    orgs: {
      partialUpdateByKey,
      createQuerySingleItem,
      createQueryCollection,
      findByKey: () => Promise.resolve(buildOrg({}, isPaidEnabled)),
    },
  };

  return {
    mongoStores,
    partialUpdateByKey,
    createQuerySingleItem,
    createQueryCollection,
  };
};

const transformerOf = (
  createQuery: ReturnType<typeof vi.fn>,
): ((org: Org) => unknown) =>
  (createQuery.mock.calls[0] as [{ transformer: (org: Org) => unknown }])[0]
    .transformer;

beforeEach(() => {
  vi.mocked(callBotApiForJson).mockReset();
});

describe("setAllowPersonalTokens", () => {
  const setAllow = (mongoStores: MongoStores, orgId = 1) =>
    createOrgsService(
      { mongoStores },
      scopes,
    ).operations.setAllowPersonalTokens({ orgId, allow: true }, loggedInUser);

  it("lets an owner allow tokens, recording who did it", async () => {
    vi.mocked(callBotApiForJson).mockResolvedValue({ role: "admin" });
    const { mongoStores, partialUpdateByKey } = createStores();

    await setAllow(mongoStores);

    expect(partialUpdateByKey).toHaveBeenCalledWith(1, {
      $set: {
        "config.allowPersonalTokens": true,
        "config.allowPersonalTokensChangedBy": {
          id: 42,
          login: "christophehurpeau",
          at: expect.any(Date),
        },
      },
    });
  });

  it("refuses to allow tokens on an org the admin did not enable", async () => {
    vi.mocked(callBotApiForJson).mockResolvedValue({ role: "admin" });
    const { mongoStores, partialUpdateByKey } = createStores(false);

    await expect(setAllow(mongoStores)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(partialUpdateByKey).not.toHaveBeenCalled();
  });

  it("refuses a member who is not an owner", async () => {
    vi.mocked(callBotApiForJson).mockResolvedValue({ role: "member" });
    const { mongoStores, partialUpdateByKey } = createStores();

    await expect(setAllow(mongoStores)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(partialUpdateByKey).not.toHaveBeenCalled();
  });

  it("refuses a user outside the org", async () => {
    const { mongoStores, partialUpdateByKey } = createStores();

    await expect(setAllow(mongoStores, 2)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(partialUpdateByKey).not.toHaveBeenCalled();
  });
});

describe("queryOrgPersonalTokensPolicy", () => {
  const query = (mongoStores: MongoStores) =>
    createOrgsService(
      { mongoStores },
      scopes,
    ).queries.queryOrgPersonalTokensPolicy({ orgId: 1 }, loggedInUser);

  it("tells an owner they can change the policy", async () => {
    vi.mocked(callBotApiForJson).mockResolvedValue({ role: "admin" });
    const { mongoStores, createQuerySingleItem } = createStores();

    await query(mongoStores);

    expect(createQuerySingleItem).toHaveBeenCalledWith(
      expect.objectContaining({ criteria: { _id: 1 } }),
    );
    expect(
      transformerOf(createQuerySingleItem)(
        buildOrg({ allowPersonalTokens: true }, true),
      ),
    ).toEqual({
      _id: 1,
      allowPersonalTokens: true,
      paidEnabled: true,
      viewerIsOwner: true,
    });
  });

  it("reads an org without config as not allowing tokens", async () => {
    vi.mocked(callBotApiForJson).mockResolvedValue({ role: "member" });
    const { mongoStores, createQuerySingleItem } = createStores();

    await query(mongoStores);

    expect(transformerOf(createQuerySingleItem)(buildOrg(undefined))).toEqual({
      _id: 1,
      allowPersonalTokens: false,
      paidEnabled: false,
      viewerIsOwner: false,
    });
  });
});

describe("queryOrgSettings", () => {
  it("asks to sign in to slack again once the user token was revoked", async () => {
    const createQuerySingleItem = vi.fn(() => "query");
    const settingsStores = {
      orgs: {
        findOne: () =>
          Promise.resolve({ _id: 1, login: "acme", slackTeamId: "T1" }),
      },
      slackTeams: { findByKey: () => Promise.resolve({ teamName: "acme" }) },
      orgMembers: {
        findOne: () =>
          Promise.resolve({
            _id: "1_42",
            org: { id: 1, login: "acme" },
            user: { id: 42 },
          }),
        createQuerySingleItem,
      },
    } as unknown as MongoStores;

    await createOrgsService(
      { mongoStores: settingsStores },
      scopes,
    ).queries.queryOrgSettings({ orgLogin: "acme" }, loggedInUser);
    const transformer = transformerOf(createQuerySingleItem) as (
      orgMember: unknown,
    ) => { slack: unknown };
    const orgMember = (slack: Record<string, unknown>) => ({
      _id: "1_42",
      teams: [],
      slack: { id: "U1", teamId: "T1", ...slack },
    });

    expect(
      transformer(orgMember({ tokenRevokedAt: new Date() })).slack,
    ).toEqual({
      state: "token-revoked",
      teamName: "acme",
      teamId: "T1",
      userId: "U1",
      usesDeprecatedCustomApp: false,
    });
    expect(transformer(orgMember({})).slack).toMatchObject({
      state: "linked",
    });
  });
});

describe("queryMyOrgs", () => {
  it("tells whether each org allows personal tokens", async () => {
    const { mongoStores, createQueryCollection } = createStores();

    await createOrgsService({ mongoStores }, scopes).queries.queryMyOrgs(
      {},
      loggedInUser,
    );
    const transformer = transformerOf(createQueryCollection);

    expect(transformer(buildOrg({ allowPersonalTokens: true }, true))).toEqual({
      _id: 1,
      login: "acme",
      status: "active",
      allowPersonalTokens: true,
      paidEnabled: true,
    });
    expect(transformer(buildOrg({}))).toMatchObject({
      allowPersonalTokens: false,
      paidEnabled: false,
    });
  });
});
