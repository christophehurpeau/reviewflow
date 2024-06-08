import type { EmitterWebhookEventName } from "@octokit/webhooks";
import { syncOrg } from "../events/account-handlers/actions/syncOrg";
import { syncTeamsAndTeamMembers } from "../events/account-handlers/actions/syncTeams";
import { syncUser } from "../events/account-handlers/actions/syncUser";
import type { ProbotEvent } from "../events/probot-types";
import type { Org, User } from "../mongo";
import type { AppContext } from "./AppContext";

export interface AccountInfo {
  id: number;
  login: string;
  type: string;
}

export const getOrCreateAccount = async <T extends EmitterWebhookEventName>(
  { mongoStores }: AppContext,
  github: ProbotEvent<T>["octokit"],
  installationId: number | undefined,
  accountInfo: AccountInfo,
): Promise<Org | User> => {
  switch (accountInfo.type) {
    case "Organization": {
      let org = await mongoStores.orgs.findByKey(accountInfo.id);
      if (org?.installationId) return org;

      // TODO diff org vs user...
      org = await syncOrg(mongoStores, github, installationId, accountInfo);
      await syncTeamsAndTeamMembers(mongoStores, github, accountInfo);
      return org;
    }

    case "User": {
      let user = await mongoStores.users.findByKey(accountInfo.id);
      if (user?.installationId) return user;

      user = await syncUser(mongoStores, github, installationId, accountInfo);
      return user;
    }

    default:
      throw new Error(`Account type not supported ${accountInfo.type}`);
  }
};
