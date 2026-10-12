import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MongoStores, Org } from "reviewflow-core";
import { callBotApiForJson } from "../botApi.ts";
import type { AuthenticatedWsUser } from "./getAuthenticatedUser.ts";
import { createOrgsService } from "./orgsService.ts";

vi.mock("../botApi.ts", () => ({
  callBotApi: vi.fn(),
  callBotApiForJson: vi.fn(),
}));

const loggedInUser: AuthenticatedWsUser = {
  id: 42,
  login: "christophehurpeau",
  accessToken: "gh-token",
};

const buildOrg = (config: Org["config"] | undefined): Org =>
  ({
    _id: 1,
    login: "acme",
    status: "active",
    config,
  }) as unknown as Org;

interface Stores {
  mongoStores: MongoStores;
  partialUpdateByKey: ReturnType<typeof vi.fn>;
  createQuerySingleItem: ReturnType<typeof vi.fn>;
  createQueryCollection: ReturnType<typeof vi.fn>;
}

/** the user is a member of org 1, and of nothing else */
const createStores = (): Stores => {
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
    orgs: { partialUpdateByKey, createQuerySingleItem, createQueryCollection },
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
    createOrgsService({ mongoStores }).operations.setAllowPersonalTokens(
      { orgId, allow: true },
      loggedInUser,
    );

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
    createOrgsService({ mongoStores }).queries.queryOrgPersonalTokensPolicy(
      { orgId: 1 },
      loggedInUser,
    );

  it("tells an owner they can change the policy", async () => {
    vi.mocked(callBotApiForJson).mockResolvedValue({ role: "admin" });
    const { mongoStores, createQuerySingleItem } = createStores();

    await query(mongoStores);

    expect(createQuerySingleItem).toHaveBeenCalledWith(
      expect.objectContaining({ criteria: { _id: 1 } }),
    );
    expect(
      transformerOf(createQuerySingleItem)(
        buildOrg({ allowPersonalTokens: true }),
      ),
    ).toEqual({ _id: 1, allowPersonalTokens: true, viewerIsOwner: true });
  });

  it("reads an org without config as not allowing tokens", async () => {
    vi.mocked(callBotApiForJson).mockResolvedValue({ role: "member" });
    const { mongoStores, createQuerySingleItem } = createStores();

    await query(mongoStores);

    expect(transformerOf(createQuerySingleItem)(buildOrg(undefined))).toEqual({
      _id: 1,
      allowPersonalTokens: false,
      viewerIsOwner: false,
    });
  });
});

describe("queryMyOrgs", () => {
  it("tells whether each org allows personal tokens", async () => {
    const { mongoStores, createQueryCollection } = createStores();

    await createOrgsService({ mongoStores }).queries.queryMyOrgs(
      {},
      loggedInUser,
    );
    const transformer = transformerOf(createQueryCollection);

    expect(transformer(buildOrg({ allowPersonalTokens: true }))).toEqual({
      _id: 1,
      login: "acme",
      status: "active",
      allowPersonalTokens: true,
    });
    expect(transformer(buildOrg({}))).toMatchObject({
      allowPersonalTokens: false,
    });
  });
});
