import type { EventPayloads } from '@octokit/webhooks';
import type { Probot } from 'probot';
import type { AppContext } from '../../context/AppContext';
import { syncOrg } from './actions/syncOrg';
import { createHandlerOrgChange } from './utils/handler';

export default function orgMemberAddedOrRemoved(
  app: Probot,
  appContext: AppContext,
): void {
  /* https://developer.github.com/webhooks/event-payloads/#organization */
  app.on(
    ['organization.member_added', 'organization.member_removed'],
    createHandlerOrgChange<EventPayloads.WebhookPayloadOrganization>(
      appContext,
      async (context, accountContext) => {
        await syncOrg(
          appContext.mongoStores,
          context.octokit,
          accountContext.account.installationId!,
          context.payload.organization,
        );
      },
    ),
  );
}
