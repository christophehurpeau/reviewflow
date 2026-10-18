import { ResourcesServerError } from "liwi-resources-server";
import type { ServiceResource } from "liwi-resources-server";
import { emojiToUnicode } from "reviewflow-core";
import type { MongoStores, Repository } from "reviewflow-core";
import type {
  RepositoriesService,
  RepositorySummary,
} from "reviewflow-modules";
import type { ResourcesContext } from "../ResourcesContext.ts";
import { callBotApi } from "../botApi.ts";
import type { AuthenticatedWsUser } from "./getAuthenticatedUser.ts";
import type { MembershipScopes } from "./membershipScopes.ts";
import { requireAccount } from "./requireAuth.ts";
import {
  createScopedQuery,
  matchNothing,
  toScopeOrUndefined,
} from "./scopedQuery.ts";

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

const resolveIsAuthorized = (
  mongoStores: MongoStores,
  accountId: number,
  user: AuthenticatedWsUser,
): Promise<boolean | undefined> =>
  toScopeOrUndefined(async () => {
    await requireAccount(mongoStores, accountId, user);
    return true;
  });

export const createRepositoriesService = (
  { mongoStores }: ResourcesContext,
  scopes: MembershipScopes,
): ServiceResource<RepositoriesService, AuthenticatedWsUser> => ({
  queries: {
    queryAccountRepositories: async ({ accountId }, loggedInUser) => {
      const { user, account } = await requireAccount(
        mongoStores,
        accountId,
        loggedInUser,
      );

      const createQuery = (isAuthorized: boolean | undefined) =>
        mongoStores.repositories.createQueryCollection({
          criteria: isAuthorized ? { "account.id": accountId } : matchNothing,
          sort: { fullName: 1 },
          transformer: toRepositorySummary,
        });

      if (account.id === user.id) return createQuery(true);

      return createScopedQuery({
        user,
        scopes,
        initialScope: true,
        resolveScope: () => resolveIsAuthorized(mongoStores, accountId, user),
        createQuery,
      });
    },

    queryRepository: async ({ accountId, name }, loggedInUser) => {
      const { user, account } = await requireAccount(
        mongoStores,
        accountId,
        loggedInUser,
      );

      const createQuery = (isAuthorized: boolean | undefined) =>
        mongoStores.repositories.createQuerySingleItem({
          criteria: isAuthorized
            ? { "account.id": accountId, fullName: `${account.login}/${name}` }
            : matchNothing,
          transformer: toRepositorySummary,
        });

      if (account.id === user.id) return createQuery(true);

      return createScopedQuery({
        user,
        scopes,
        initialScope: true,
        resolveScope: () => resolveIsAuthorized(mongoStores, accountId, user),
        createQuery,
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
