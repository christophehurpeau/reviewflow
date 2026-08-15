import type { ServiceResource } from "liwi-resources-server";
import { ResourcesServerService } from "liwi-resources-server";
import type { ResourcesContext } from "../ResourcesContext.ts";
import { createOrgsService } from "./orgsService.ts";
import { createPrsService } from "./prsService.ts";
import { createRepositoriesService } from "./repositoriesService.ts";
import { createUsersService } from "./usersService.ts";

export const createResourcesServerService = (
  appContext: ResourcesContext,
): ResourcesServerService =>
  new ResourcesServerService({
    serviceResources: new Map<string, ServiceResource<any, any>>([
      ["users", createUsersService(appContext)],
      ["orgs", createOrgsService(appContext)],
      ["repositories", createRepositoriesService(appContext)],
      ["prs", createPrsService(appContext)],
    ]),
  });
