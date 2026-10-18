import type { ServiceResource } from "liwi-resources-server";
import { ResourcesServerService } from "liwi-resources-server";
import type { ResourcesContext } from "../ResourcesContext.ts";
import { createAdminService } from "./adminService.ts";
import type { SpannedAccounts } from "./liveUpdatesGate.ts";
import { withLiveUpdatesGate } from "./liveUpdatesGate.ts";
import type { MembershipScopes } from "./membershipScopes.ts";
import { createMembershipScopes } from "./membershipScopes.ts";
import { createOrgsService } from "./orgsService.ts";
import type { PaidAccounts } from "./paidAccounts.ts";
import { createPaidAccounts } from "./paidAccounts.ts";
import { createPersonalTokensService } from "./personalTokensService.ts";
import { createPrsService } from "./prsService.ts";
import { createRepositoriesService } from "./repositoriesService.ts";
import { requireAccount, requireAccounts } from "./requireAuth.ts";
import type { SubscriptionSlots } from "./subscriptionLimits.ts";
import {
  createSubscriptionSlots,
  readSubscriptionLimits,
  withSubscriptionLimits,
} from "./subscriptionLimits.ts";
import { createUsersService } from "./usersService.ts";

export const createResourcesServerService = (
  appContext: ResourcesContext,
  slots: SubscriptionSlots = createSubscriptionSlots(readSubscriptionLimits()),
  scopes: MembershipScopes = createMembershipScopes(
    appContext.mongoStores.orgMembers,
  ),
  paid: PaidAccounts = createPaidAccounts(appContext.mongoStores),
): ResourcesServerService => {
  const { mongoStores } = appContext;

  const accountOf: SpannedAccounts = async ({ accountId }, user) => {
    await requireAccount(mongoStores, accountId, user);
    return [accountId];
  };

  const accountsOfMyPrs: SpannedAccounts = async ({ accountId }, user) => {
    const { accounts } = await requireAccounts(mongoStores, accountId, user);
    return accounts.map((account) => account.accountId);
  };

  /**
   * Only the queries reading an account's data are gated: the user, their
   * orgs, their settings and their tokens stay live, the screens that edit them
   * showing the result of a write through them.
   */
  const resources: [
    string,
    ServiceResource<any, any>,
    Record<string, SpannedAccounts>?,
  ][] = [
    ["users", createUsersService(appContext)],
    ["orgs", createOrgsService(appContext, scopes)],
    [
      "repositories",
      createRepositoriesService(appContext, scopes),
      { queryAccountRepositories: accountOf, queryRepository: accountOf },
    ],
    [
      "prs",
      createPrsService(appContext, scopes),
      { queryMyPrs: accountsOfMyPrs },
    ],
    ["personalTokens", createPersonalTokensService(appContext)],
    ["admin", createAdminService(appContext)],
  ];

  return new ResourcesServerService({
    serviceResources: new Map<string, ServiceResource<any, any>>(
      resources.map(([name, resource, spans]) => {
        const limited = withSubscriptionLimits(resource, slots);
        return [
          name,
          spans
            ? withLiveUpdatesGate(limited, { paid, scopes, spans })
            : limited,
        ];
      }),
    ),
  });
};
