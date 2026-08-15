import { describe, expect, it } from "vitest";
import type { MongoStores, OrgMember } from "reviewflow-core";
import type { AuthenticatedWsUser } from "./getAuthenticatedUser.ts";
import { requireAccount, requireAccounts } from "./requireAuth.ts";

const loggedInUser: AuthenticatedWsUser = {
  id: 42,
  login: "christophehurpeau",
  accessToken: "token",
};

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

describe("requireAccounts", () => {
  const team = { id: 9, name: "dev", slug: "dev" };

  it("spans the user's own account and every org membership", async () => {
    const { accounts } = await requireAccounts(
      createStores([orgMember(1, [team])]),
      null,
      loggedInUser,
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
      loggedInUser,
    );

    expect(accounts).toEqual([{ accountId: 42, teams: [] }]);
  });

  it("scopes to the user's own account without any membership", async () => {
    const { accounts } = await requireAccounts(
      createStores([]),
      42,
      loggedInUser,
    );

    expect(accounts).toEqual([{ accountId: 42, teams: [] }]);
  });

  it("scopes to a single org with its teams", async () => {
    const { accounts } = await requireAccounts(
      createStores([orgMember(1, [team])]),
      1,
      loggedInUser,
    );

    expect(accounts).toEqual([{ accountId: 1, teams: [team] }]);
  });

  it("rejects an org the user does not belong to", async () => {
    await expect(
      requireAccounts(createStores([orgMember(1, [])]), 2, loggedInUser),
    ).rejects.toThrow("You are not a member of this organization");
  });

  it("rejects an anonymous caller", async () => {
    await expect(
      requireAccounts(createStores([]), null, undefined),
    ).rejects.toThrow("Not authenticated");
  });
});

describe("requireAccount", () => {
  it("resolves the user's own account without any lookup", async () => {
    const { account } = await requireAccount(
      createStores([]),
      42,
      loggedInUser,
    );

    expect(account).toEqual({ id: 42, login: "christophehurpeau" });
  });

  it("resolves an org the user belongs to", async () => {
    const { account } = await requireAccount(
      createStores([orgMember(1, [])]),
      1,
      loggedInUser,
    );

    expect(account).toEqual({ id: 1, login: "org-1" });
  });

  it("rejects an org the user does not belong to", async () => {
    await expect(
      requireAccount(createStores([orgMember(1, [])]), 2, loggedInUser),
    ).rejects.toThrow("You are not a member of this organization");
  });

  it("rejects an org member whose org document is gone", async () => {
    await expect(
      requireAccount(createStores([orgMember(1, [])], []), 1, loggedInUser),
    ).rejects.toThrow("Unknown organization");
  });

  it("rejects an anonymous caller", async () => {
    await expect(
      requireAccount(createStores([]), 42, undefined),
    ).rejects.toThrow("Not authenticated");
  });
});
