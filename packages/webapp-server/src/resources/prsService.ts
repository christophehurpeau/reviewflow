import type { ServiceResource } from "liwi-resources-server";
import { buildPrBucketQuery } from "reviewflow-core";
import type { PrsService } from "reviewflow-modules";
import type { ResourcesContext } from "../ResourcesContext.ts";
import { toPrSummary } from "../prs/toPrSummary.ts";
import type { AuthenticatedWsUser } from "./getAuthenticatedUser.ts";
import { requireAccounts } from "./requireAuth.ts";

export const createPrsService = ({
  mongoStores,
}: ResourcesContext): ServiceResource<PrsService, AuthenticatedWsUser> => ({
  queries: {
    queryMyPrs: async ({ accountId, bucket }, loggedInUser) => {
      const { user, accounts } = await requireAccounts(
        mongoStores,
        accountId,
        loggedInUser,
      );

      const { criteria, sort } = buildPrBucketQuery(bucket, {
        userId: user.id,
        accounts,
      });

      return mongoStores.prs.createQueryCollection({
        criteria,
        sort,
        limit: 100,
        transformer: toPrSummary,
      });
    },
  },
  operations: {},
});
