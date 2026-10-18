import { ResourcesServerError } from "liwi-resources-server";
import type { ServiceResource } from "liwi-resources-server";
import { isPaidEnabled } from "reviewflow-core";
import type { UserSummary, UsersService } from "reviewflow-modules";
import type { ResourcesContext } from "../ResourcesContext.ts";
import { callBotApi } from "../botApi.ts";
import { isAdminUser, readAdminUserIds } from "./adminAuth.ts";
import type { AuthenticatedWsUser } from "./getAuthenticatedUser.ts";
import { requireAuthenticatedUser } from "./requireAuth.ts";

export const createUsersService = (
  { mongoStores }: ResourcesContext,
  adminUserIds: ReadonlySet<number> = readAdminUserIds(),
): ServiceResource<UsersService, AuthenticatedWsUser> => ({
  queries: {
    queryMe: (params, loggedInUser) => {
      const user = requireAuthenticatedUser(loggedInUser);
      return mongoStores.users.createQuerySingleItem({
        criteria: { _id: user.id },
        transformer: (account): UserSummary => ({
          _id: account._id,
          login: account.login,
          installed: account.installationId != null,
          paidEnabled: isPaidEnabled(account),
        }),
      });
    },
  },
  operations: {
    getAuthenticatedUser: (params, loggedInUser) => {
      const user = requireAuthenticatedUser(loggedInUser);
      return Promise.resolve({
        id: user.id,
        login: user.login,
        isAdmin: isAdminUser(adminUserIds, user),
      });
    },

    forceSync: async (params, loggedInUser) => {
      const user = requireAuthenticatedUser(loggedInUser);
      const userInDb = await mongoStores.users.findByKey(user.id);
      if (!userInDb?.installationId) {
        throw new ResourcesServerError(
          "NOT_INSTALLED",
          "Reviewflow is not installed for this user",
        );
      }

      await callBotApi("/sync/user", { userId: user.id });
    },
  },
});
