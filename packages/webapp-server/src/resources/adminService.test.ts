import { describe, expect, it, vi } from "vitest";
import type { MongoStores } from "reviewflow-core";
import { isAdminUser, readAdminUserIds } from "./adminAuth.ts";
import { createAdminService } from "./adminService.ts";
import type { AuthenticatedWsUser } from "./getAuthenticatedUser.ts";

const adminUser: AuthenticatedWsUser = {
  id: 1_234_567,
  login: "jane-doe",
  accessToken: "token",
};

const adminInEditor: AuthenticatedWsUser = {
  ...adminUser,
  isEditorSession: true,
};

const otherUser: AuthenticatedWsUser = {
  id: 42,
  login: "someone",
  accessToken: "token",
};

const createStores = () => {
  const orgsPartialUpdateByKey = vi.fn(() => Promise.resolve());
  const usersPartialUpdateByKey = vi.fn(() => Promise.resolve());
  const createOrgsQuery = vi.fn(() => "orgs query");
  const createUsersQuery = vi.fn(() => "users query");
  const mongoStores = {
    orgs: {
      findByKey: (id: number) =>
        Promise.resolve(id === 1 ? { _id: 1, installationId: 10 } : undefined),
      partialUpdateByKey: orgsPartialUpdateByKey,
      createQueryCollection: createOrgsQuery,
    },
    users: {
      findByKey: (id: number) =>
        Promise.resolve(id === 3 ? { _id: 3, installationId: 30 } : undefined),
      partialUpdateByKey: usersPartialUpdateByKey,
      createQueryCollection: createUsersQuery,
    },
  } as unknown as MongoStores;
  return {
    mongoStores,
    orgsPartialUpdateByKey,
    usersPartialUpdateByKey,
    createOrgsQuery,
    createUsersQuery,
  };
};

const createService = (adminUserIds: ReadonlySet<number>) => {
  const stores = createStores();
  return {
    ...stores,
    service: createAdminService(
      { mongoStores: stores.mongoStores },
      adminUserIds,
    ),
  };
};

describe("readAdminUserIds", () => {
  it("reads the comma-separated github user ids", () => {
    expect(
      readAdminUserIds({ REVIEWFLOW_ADMIN_USER_IDS: "1234567, 42 ,x,,-1,0" }),
    ).toEqual(new Set([1_234_567, 42]));
  });

  it("has no admin when empty or unset", () => {
    expect(readAdminUserIds({ REVIEWFLOW_ADMIN_USER_IDS: "" }).size).toBe(0);
    expect(readAdminUserIds({}).size).toBe(0);
  });

  it("matches on the user id, not the login", () => {
    const ids = new Set([1_234_567]);
    expect(isAdminUser(ids, adminUser)).toBe(true);
    expect(isAdminUser(ids, { ...adminUser, id: 1 })).toBe(false);
    expect(isAdminUser(ids, undefined)).toBe(false);
  });

  it("is never an editor session, whatever the id", () => {
    expect(isAdminUser(new Set([1_234_567]), adminInEditor)).toBe(false);
  });
});

describe("the admin service authorization", () => {
  const params = {
    accountId: 1,
    accountType: "Organization",
    enabled: true,
  } as const;

  it.each([
    ["a user who is not an admin", otherUser, new Set([1_234_567])],
    ["a user while no admin is configured", adminUser, new Set<number>()],
    [
      "the admin signed in through the editor",
      adminInEditor,
      new Set([1_234_567]),
    ],
  ])("refuses %s on every query and operation", async (_name, user, ids) => {
    const {
      service,
      orgsPartialUpdateByKey,
      createOrgsQuery,
      createUsersQuery,
    } = createService(ids);

    await expect(
      Promise.resolve().then(() => service.queries.queryAdminOrgs({}, user)),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      Promise.resolve().then(() => service.queries.queryAdminUsers({}, user)),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      service.operations.setAccountPaidEnabled(params, user),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(createOrgsQuery).not.toHaveBeenCalled();
    expect(createUsersQuery).not.toHaveBeenCalled();
    expect(orgsPartialUpdateByKey).not.toHaveBeenCalled();
  });

  it("refuses an unauthenticated caller", async () => {
    const { service } = createService(new Set([1_234_567]));

    await expect(
      Promise.resolve().then(() =>
        service.queries.queryAdminOrgs({}, undefined),
      ),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await expect(
      service.operations.setAccountPaidEnabled(params, undefined),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });
});

describe("the admin service as an admin", () => {
  const ids = new Set([1_234_567]);

  it("lists installed orgs and users", async () => {
    const { service, createOrgsQuery, createUsersQuery } = createService(ids);

    await service.queries.queryAdminOrgs({}, adminUser);
    await service.queries.queryAdminUsers({}, adminUser);

    expect(createOrgsQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        criteria: { installationId: { $gt: 0 }, status: { $ne: "deleted" } },
      }),
    );
    expect(createUsersQuery).toHaveBeenCalledWith(
      expect.objectContaining({ criteria: { installationId: { $gt: 0 } } }),
    );
  });

  it("summarizes an account with its flag, off by default", async () => {
    const { service, createOrgsQuery } = createService(ids);
    await service.queries.queryAdminOrgs({}, adminUser);
    const { transformer } = (
      createOrgsQuery.mock.calls[0] as unknown as [
        { transformer: (org: unknown) => unknown },
      ]
    )[0];

    expect(
      transformer({ _id: 1, login: "elax", created: new Date(0) }),
    ).toEqual({
      _id: 1,
      login: "elax",
      type: "Organization",
      knownSince: new Date(0),
      paidEnabled: false,
    });
    expect(
      transformer({ _id: 1, login: "elax", paidFeatures: { enabled: true } }),
    ).toMatchObject({ paidEnabled: true });
  });

  it("sets the flag of an org on its own fields only", async () => {
    const { service, orgsPartialUpdateByKey, usersPartialUpdateByKey } =
      createService(ids);

    await service.operations.setAccountPaidEnabled(
      { accountId: 1, accountType: "Organization", enabled: true },
      adminUser,
    );

    expect(orgsPartialUpdateByKey).toHaveBeenCalledWith(1, {
      $set: {
        "paidFeatures.enabled": true,
        "paidFeatures.changedBy": {
          id: 1_234_567,
          login: "jane-doe",
          at: expect.any(Date),
        },
      },
    });
    expect(usersPartialUpdateByKey).not.toHaveBeenCalled();
  });

  it("sets the flag of a user in the users store", async () => {
    const { service, orgsPartialUpdateByKey, usersPartialUpdateByKey } =
      createService(ids);

    await service.operations.setAccountPaidEnabled(
      { accountId: 3, accountType: "User", enabled: false },
      adminUser,
    );

    expect(usersPartialUpdateByKey).toHaveBeenCalledWith(
      3,
      expect.objectContaining({
        $set: expect.objectContaining({ "paidFeatures.enabled": false }),
      }),
    );
    expect(orgsPartialUpdateByKey).not.toHaveBeenCalled();
  });

  it("refuses an account reviewflow is not installed on", async () => {
    const { service, orgsPartialUpdateByKey } = createService(ids);

    await expect(
      service.operations.setAccountPaidEnabled(
        { accountId: 99, accountType: "Organization", enabled: true },
        adminUser,
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(orgsPartialUpdateByKey).not.toHaveBeenCalled();
  });
});
