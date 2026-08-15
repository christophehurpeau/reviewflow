import { ResourcesServerError } from "liwi-resources-server";
import type { ServiceResource } from "liwi-resources-server";
import { emojiToUnicode } from "reviewflow-core";
import type { Repository } from "reviewflow-core";
import type {
  RepositoriesService,
  RepositorySummary,
} from "reviewflow-modules";
import type { ResourcesContext } from "../ResourcesContext.ts";
import type { AuthenticatedWsUser } from "./getAuthenticatedUser.ts";
import { requireOrgMember } from "./requireAuth.ts";

const toRepositorySummary = ({
  _id,
  fullName,
  emoji,
  account,
}: Repository): RepositorySummary => ({
  _id,
  name: fullName.slice(fullName.indexOf("/") + 1),
  fullName,
  emoji: emojiToUnicode(emoji),
  orgLogin: account.login,
});

export const createRepositoriesService = ({
  mongoStores,
}: ResourcesContext): ServiceResource<
  RepositoriesService,
  AuthenticatedWsUser
> => ({
  queries: {
    queryOrgRepositories: async ({ orgId }, loggedInUser) => {
      await requireOrgMember(mongoStores, orgId, loggedInUser);

      return mongoStores.repositories.createQueryCollection({
        criteria: { "account.id": orgId },
        sort: { fullName: 1 },
        transformer: toRepositorySummary,
      });
    },

    queryRepository: async ({ orgId, name }, loggedInUser) => {
      await requireOrgMember(mongoStores, orgId, loggedInUser);
      const org = await mongoStores.orgs.findByKey(orgId);
      if (!org) {
        throw new ResourcesServerError("NOT_FOUND", "Unknown organization");
      }

      return mongoStores.repositories.createQuerySingleItem({
        criteria: { "account.id": orgId, fullName: `${org.login}/${name}` },
        transformer: toRepositorySummary,
      });
    },
  },
  operations: {},
});
