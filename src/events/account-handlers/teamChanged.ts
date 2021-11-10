import type { Probot } from 'probot';
import type { AppContext } from '../../context/AppContext';
import { syncTeams } from './actions/syncTeams';
import { createHandlerOrgChange } from './utils/createHandlerOrgChange';

export default function teamChanged(app: Probot, appContext: AppContext): void {
  /* https://developer.github.com/webhooks/event-payloads/#team */
  createHandlerOrgChange(
    app,
    appContext,
    ['team.created', 'team.deleted', 'team.edited'],
    async (context, accountContext) => {
      await syncTeams(
        appContext.mongoStores,
        context.octokit,
        context.payload.organization,
      );
    },
  );
}
