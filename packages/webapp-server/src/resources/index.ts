import type { ServiceResource } from "liwi-resources-server";
import { ResourcesServerService } from "liwi-resources-server";
import type { ResourcesContext } from "../ResourcesContext.ts";
import { createOrgsService } from "./orgsService.ts";
import { createPersonalTokensService } from "./personalTokensService.ts";
import { createPrsService } from "./prsService.ts";
import { createRepositoriesService } from "./repositoriesService.ts";
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
): ResourcesServerService =>
  new ResourcesServerService({
    serviceResources: new Map<string, ServiceResource<any, any>>(
      (
        [
          ["users", createUsersService(appContext)],
          ["orgs", createOrgsService(appContext)],
          ["repositories", createRepositoriesService(appContext)],
          ["prs", createPrsService(appContext)],
          ["personalTokens", createPersonalTokensService(appContext)],
        ] as const
      ).map(([name, resource]) => [
        name,
        withSubscriptionLimits(resource, slots),
      ]),
    ),
  });
