import { describe, expect, it, vi } from "vitest";
import type { MongoStores, OrgMember } from "reviewflow-core";
import type { AuthenticatedWsUser } from "./getAuthenticatedUser.ts";
import { requireAccount, requireAccounts } from "./requireAuth.ts";

/** the membership cache is keyed on this object, so no two cases may share one */
const createLoggedInUser = (): AuthenticatedWsUser => ({
  id: 42,
  login: "christophehurpeau",
  accessToken: "token",
});

const orgMember = (orgId: number, teams: OrgMember["teams"]): OrgMember => ({
  _id: `${orgId}_42`,
  org: { id: orgId, login: `org-${orgId}` },
  user: { id: 42, login: "christophehurpeau" },
  teams,
  created: new Date(),
  updated: new Date(),
});

const createStores = (
  orgMembers: OrgMember[],
  knownOrgIds = orgMembers.map(({ org }) => org.id),
): MongoStores => {
  const mongoStores: any = {
    orgMembers: {
      findAll: () => Promise.resolve(orgMembers),
      findOne: ({ "org.id": orgId }: Record<string, number>) =>
        Promise.resolve(
          orgMembers.find((member) => member.org.id === orgId) ?? null,
        ),
    },
    orgs: {
      findByKey: (orgId: number) =>
        Promise.resolve(
          knownOrgIds.includes(orgId)
            ? { _id: orgId, login: `org-${orgId}` }
            : undefined,
        ),
    },
  };

  return mongoStores;
};

const spyOnLookups = (mongoStores: MongoStores) => {
  const findAll = vi.fn(mongoStores.orgMembers.findAll);
  const findOne = vi.fn(mongoStores.orgMembers.findOne);
  mongoStores.orgMembers.findAll = findAll;
  mongoStores.orgMembers.findOne = findOne;
  return { findAll, findOne };
};

describe("requireAccounts", () => {
  const team = { id: 9, name: "dev", slug: "dev" };

  it("spans the user's own account and every org membership", async () => {
    const { accounts } = await requireAccounts(
      createStores([orgMember(1, [team])]),
      null,
      createLoggedInUser(),
    );

    expect(accounts).toEqual([
      { accountId: 42, teams: [] },
      { accountId: 1, teams: [team] },
    ]);
  });

  it("keeps the user's own account when no org is installed", async () => {
    const { accounts } = await requireAccounts(
      createStores([]),
      null,
      createLoggedInUser(),
    );

    expect(accounts).toEqual([{ accountId: 42, teams: [] }]);
  });

  it("scopes to the user's own account without any membership", async () => {
    const { accounts } = await requireAccounts(
      createStores([]),
      42,
      createLoggedInUser(),
    );

    expect(accounts).toEqual([{ accountId: 42, teams: [] }]);
  });

  it("scopes to a single org with its teams", async () => {
    const { accounts } = await requireAccounts(
      createStores([orgMember(1, [team])]),
      1,
      createLoggedInUser(),
    );

    expect(accounts).toEqual([{ accountId: 1, teams: [team] }]);
  });

  it("rejects an org the user does not belong to", async () => {
    await expect(
      requireAccounts(
        createStores([orgMember(1, [])]),
        2,
        createLoggedInUser(),
      ),
    ).rejects.toThrow("You are not a member of this organization");
  });

  it("rejects an anonymous caller", async () => {
    await expect(
      requireAccounts(createStores([]), null, undefined),
    ).rejects.toThrow("Not authenticated");
  });

  it("looks the memberships up once for the queries of one connection", async () => {
    const stores = createStores([orgMember(1, [team])]);
    const { findAll } = spyOnLookups(stores);
    const user = createLoggedInUser();

    const results = await Promise.all(
      Array.from({ length: 7 }, () => requireAccounts(stores, null, user)),
    );

    expect(findAll).toHaveBeenCalledTimes(1);
    for (const { accounts } of results) {
      expect(accounts).toEqual([
        { accountId: 42, teams: [] },
        { accountId: 1, teams: [team] },
      ]);
    }
  });

  it("looks them up again for another connection", async () => {
    const stores = createStores([orgMember(1, [team])]);
    const { findAll } = spyOnLookups(stores);

    await requireAccounts(stores, null, createLoggedInUser());
    await requireAccounts(stores, null, createLoggedInUser());

    expect(findAll).toHaveBeenCalledTimes(2);
  });

  it("does not hold on to a rejected membership lookup", async () => {
    const stores = createStores([orgMember(1, [])]);
    const { findOne } = spyOnLookups(stores);
    const user = createLoggedInUser();

    await expect(requireAccounts(stores, 2, user)).rejects.toThrow(
      "You are not a member of this organization",
    );
    await expect(requireAccounts(stores, 2, user)).rejects.toThrow(
      "You are not a member of this organization",
    );

    expect(findOne).toHaveBeenCalledTimes(2);
  });
});

describe("requireAccount", () => {
  it("resolves the user's own account without any lookup", async () => {
    const { account } = await requireAccount(
      createStores([]),
      42,
      createLoggedInUser(),
    );

    expect(account).toEqual({ id: 42, login: "christophehurpeau" });
  });

  it("resolves an org the user belongs to", async () => {
    const { account } = await requireAccount(
      createStores([orgMember(1, [])]),
      1,
      createLoggedInUser(),
    );

    expect(account).toEqual({ id: 1, login: "org-1" });
  });

  it("rejects an org the user does not belong to", async () => {
    await expect(
      requireAccount(createStores([orgMember(1, [])]), 2, createLoggedInUser()),
    ).rejects.toThrow("You are not a member of this organization");
  });

  it("rejects an org member whose org document is gone", async () => {
    await expect(
      requireAccount(
        createStores([orgMember(1, [])], []),
        1,
        createLoggedInUser(),
      ),
    ).rejects.toThrow("Unknown organization");
  });

  it("rejects an anonymous caller", async () => {
    await expect(
      requireAccount(createStores([]), 42, undefined),
    ).rejects.toThrow("Not authenticated");
  });
});
