import { describe, expect, it } from "vitest";
import type { MongoStores, OrgMember } from "reviewflow-core";
import type { AuthenticatedWsUser } from "./getAuthenticatedUser.ts";
import { requireAccounts } from "./requireAuth.ts";

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

const createStores = (orgMembers: OrgMember[]): MongoStores => {
  const mongoStores: any = {
    orgMembers: {
      findAll: () => Promise.resolve(orgMembers),
      findOne: ({ "org.id": orgId }: Record<string, number>) =>
        Promise.resolve(
          orgMembers.find((member) => member.org.id === orgId) ?? null,
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
