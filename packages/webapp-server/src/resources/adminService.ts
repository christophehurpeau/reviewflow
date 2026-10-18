import { ResourcesServerError } from "liwi-resources-server";
import type { ServiceResource } from "liwi-resources-server";
import type { MongoStores } from "reviewflow-core";
import type {
  AdminAccountSummary,
  AdminAccountType,
  AdminService,
} from "reviewflow-modules";
import type { ResourcesContext } from "../ResourcesContext.ts";
import { readAdminUserIds, requireAdmin } from "./adminAuth.ts";
import type { AuthenticatedWsUser } from "./getAuthenticatedUser.ts";

const installedCriteria = { installationId: { $gt: 0 } };

const toAdminAccountSummary =
  (type: AdminAccountType) =>
  ({
    _id,
    login,
    created,
    paidFeatures,
  }: {
    _id: number;
    login: string;
    created?: Date;
    paidFeatures?: { enabled?: boolean };
  }): AdminAccountSummary => ({
    _id,
    login,
    type,
    knownSince: created,
    paidEnabled: paidFeatures?.enabled === true,
  });

const setPaidEnabled = async (
  mongoStores: MongoStores,
  {
    accountId,
    accountType,
    enabled,
  }: Parameters<AdminService["operations"]["setAccountPaidEnabled"]>[0],
  admin: AuthenticatedWsUser,
): Promise<void> => {
  const store = accountType === "Organization" ? "orgs" : "users";
  const account = await mongoStores[store].findByKey(accountId);
  if (!account?.installationId) {
    throw new ResourcesServerError(
      "NOT_FOUND",
      "Reviewflow is not installed on this account",
    );
  }

  // own fields only: the bot upserts never carry them, so a sync keeps the flag
  await mongoStores[store].partialUpdateByKey(accountId, {
    $set: {
      "paidFeatures.enabled": enabled,
      "paidFeatures.changedBy": {
        id: admin.id,
        login: admin.login,
        at: new Date(),
      },
    },
  });
};

export const createAdminService = (
  { mongoStores }: ResourcesContext,
  adminUserIds: ReadonlySet<number> = readAdminUserIds(),
): ServiceResource<AdminService, AuthenticatedWsUser> => ({
  queries: {
    queryAdminOrgs: (params, loggedInUser) => {
      requireAdmin(adminUserIds, loggedInUser);
      return mongoStores.orgs.createQueryCollection({
        criteria: { ...installedCriteria, status: { $ne: "deleted" } },
        sort: { login: 1 },
        transformer: toAdminAccountSummary("Organization"),
      });
    },

    queryAdminUsers: (params, loggedInUser) => {
      requireAdmin(adminUserIds, loggedInUser);
      return mongoStores.users.createQueryCollection({
        criteria: installedCriteria,
        sort: { login: 1 },
        transformer: toAdminAccountSummary("User"),
      });
    },
  },

  operations: {
    setAccountPaidEnabled: async (params, loggedInUser) => {
      const admin = requireAdmin(adminUserIds, loggedInUser);
      await setPaidEnabled(mongoStores, params, admin);
    },
  },
});
