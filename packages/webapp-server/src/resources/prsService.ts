import type { ServiceResource } from "liwi-resources-server";
import { buildPrBucketQuery } from "reviewflow-core";
import type { PrsService } from "reviewflow-modules";
import type { ResourcesContext } from "../ResourcesContext.ts";
import { toPrSummary } from "../prs/toPrSummary.ts";
import type { AuthenticatedWsUser } from "./getAuthenticatedUser.ts";
import { requireOrgMembers } from "./requireAuth.ts";

export const createPrsService = ({
  mongoStores,
}: ResourcesContext): ServiceResource<PrsService, AuthenticatedWsUser> => ({
  queries: {
    queryMyPrs: async ({ orgId, bucket }, loggedInUser) => {
      const { user, orgMembers } = await requireOrgMembers(
        mongoStores,
        orgId,
        loggedInUser,
      );

      const { criteria, sort } = buildPrBucketQuery(bucket, {
        userId: user.id,
        orgs: orgMembers.map((orgMember) => ({
          orgId: orgMember.org.id,
          teams: orgMember.teams,
        })),
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
