import { ResourcesServerError } from "liwi-resources-server";
import type { ServiceResource } from "liwi-resources-server";
import type { UserSummary, UsersService } from "reviewflow-modules";
import type { ResourcesContext } from "../ResourcesContext.ts";
import { callBotApi } from "../botApi.ts";
import type { AuthenticatedWsUser } from "./getAuthenticatedUser.ts";
import { requireAuthenticatedUser } from "./requireAuth.ts";

export const createUsersService = ({
  mongoStores,
}: ResourcesContext): ServiceResource<UsersService, AuthenticatedWsUser> => ({
  queries: {
    queryMe: (params, loggedInUser) => {
      const user = requireAuthenticatedUser(loggedInUser);
      return mongoStores.users.createQuerySingleItem({
        criteria: { _id: user.id },
        transformer: ({ _id, login, installationId }): UserSummary => ({
          _id,
          login,
          installed: installationId != null,
        }),
      });
    },
  },
  operations: {
    getAuthenticatedUser: (params, loggedInUser) => {
      const user = requireAuthenticatedUser(loggedInUser);
      return Promise.resolve({ id: user.id, login: user.login });
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
