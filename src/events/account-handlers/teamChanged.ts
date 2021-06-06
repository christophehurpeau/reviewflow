import type { EventPayloads } from '@octokit/webhooks';
import type { Probot } from 'probot';
import type { AppContext } from '../../context/AppContext';
import { syncTeams } from './actions/syncTeams';
import { createHandlerOrgChange } from './utils/handler';

export default function teamChanged(app: Probot, appContext: AppContext): void {
  /* https://developer.github.com/webhooks/event-payloads/#team */
  app.on(
    ['team.created', 'team.deleted', 'team.edited'],
    createHandlerOrgChange<EventPayloads.WebhookPayloadTeam>(
      appContext,
      async (context, accountContext) => {
        await syncTeams(
          appContext.mongoStores,
          context.octokit,
          context.payload.organization,
        );
      },
    ),
  );
}
