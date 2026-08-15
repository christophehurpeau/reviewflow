import { ResourcesServerError } from "liwi-resources-server";
import type { ServiceResource } from "liwi-resources-server";
import { emojiToUnicode } from "reviewflow-core";
import type { Repository } from "reviewflow-core";
import type {
  RepositoriesService,
  RepositorySummary,
} from "reviewflow-modules";
import type { ResourcesContext } from "../ResourcesContext.ts";
import { callBotApi } from "../botApi.ts";
import type { AuthenticatedWsUser } from "./getAuthenticatedUser.ts";
import { requireAccount } from "./requireAuth.ts";

const toRepositorySummary = ({
  _id,
  fullName,
  emoji,
  account,
  archived,
}: Repository): RepositorySummary => ({
  _id,
  name: fullName.slice(fullName.indexOf("/") + 1),
  fullName,
  emoji: emojiToUnicode(emoji),
  accountLogin: account.login,
  archived: archived ?? false,
});

export const createRepositoriesService = ({
  mongoStores,
}: ResourcesContext): ServiceResource<
  RepositoriesService,
  AuthenticatedWsUser
> => ({
  queries: {
    queryAccountRepositories: async ({ accountId }, loggedInUser) => {
      await requireAccount(mongoStores, accountId, loggedInUser);

      return mongoStores.repositories.createQueryCollection({
        criteria: { "account.id": accountId },
        sort: { fullName: 1 },
        transformer: toRepositorySummary,
      });
    },

    queryRepository: async ({ accountId, name }, loggedInUser) => {
      const { account } = await requireAccount(
        mongoStores,
        accountId,
        loggedInUser,
      );

      return mongoStores.repositories.createQuerySingleItem({
        criteria: {
          "account.id": accountId,
          fullName: `${account.login}/${name}`,
        },
        transformer: toRepositorySummary,
      });
    },
  },

  operations: {
    syncRepository: async ({ accountId, repositoryId }, loggedInUser) => {
      await requireAccount(mongoStores, accountId, loggedInUser);

      const repository = await mongoStores.repositories.findByKey(repositoryId);
      if (repository?.account.id !== accountId) {
        throw new ResourcesServerError("NOT_FOUND", "Unknown repository");
      }

      await callBotApi("/sync/repository", { repositoryId });
    },
  },
});
