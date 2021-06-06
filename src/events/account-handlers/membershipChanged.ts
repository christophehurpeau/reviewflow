import type { EventPayloads } from '@octokit/webhooks';
import type { Probot } from 'probot';
import type { AppContext } from '../../context/AppContext';
import { syncTeamsAndTeamMembers } from './actions/syncTeams';
import { createHandlerOrgChange } from './utils/handler';

export default function membershipChanged(
  app: Probot,
  appContext: AppContext,
): void {
  /* https://developer.github.com/webhooks/event-payloads/#membership */
  app.on(
    ['membership.added', 'membership.removed'],
    createHandlerOrgChange<EventPayloads.WebhookPayloadMembership>(
      appContext,
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
    ),
  );
}
