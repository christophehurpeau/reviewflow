import type { Probot } from "probot";
import type { AppContext } from "../../context/AppContext.ts";
import { syncTeamsAndTeamMembers } from "./actions/syncTeams.ts";
import { createHandlerOrgChange } from "./utils/createHandlerOrgChange.ts";

export default function membershipChanged(
  app: Probot,
  appContext: AppContext,
): void {
  /* https://developer.github.com/webhooks/event-payloads/#membership */

  createHandlerOrgChange(
    app,
    appContext,
    ["membership.added", "membership.removed"],
    async (context, accountContext) => {
      // TODO: only sync team members and team parents members
      // await syncTeamMembersWithTeamParents(
      //   appContext.mongoStores,
      //   context.octokit,
      //   context.payload.organization,
      //   {
      //     id: context.payload.team.id,
      //     name: context.payload.team.name,
      //     slug: context.payload.team.slug,
      //   },
      // );
      await syncTeamsAndTeamMembers(
        appContext.mongoStores,
        context.octokit,
        context.payload.organization,
      );
      await accountContext.updateGithubTeamMembers();
    },
  );
}
