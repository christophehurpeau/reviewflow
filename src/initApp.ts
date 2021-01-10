import type { EventPayloads } from '@octokit/webhooks';
import type { Probot } from 'probot';
// import commands from 'probot-commands';
import type { AppContext } from './context/AppContext';
import { syncOrg } from './events/account-handlers/actions/syncOrg';
import {
  syncTeams,
  syncTeamsAndTeamMembers,
} from './events/account-handlers/actions/syncTeams';
import { createHandlerOrgChange } from './events/account-handlers/utils/handler';
import checkrunCompleted from './events/pr-handlers/checkrunCompleted';
import checksuiteCompleted from './events/pr-handlers/checksuiteCompleted';
import closedHandler from './events/pr-handlers/closed';
import commentCreated from './events/pr-handlers/commentCreated';
import commentEditedOrDeleted from './events/pr-handlers/commentEditedOrDeleted';
import editedHandler from './events/pr-handlers/edited';
import labelsChanged from './events/pr-handlers/labelsChanged';
import openedHandler from './events/pr-handlers/opened';
import reopenedHandler from './events/pr-handlers/reopened';
import reviewDismissedHandler from './events/pr-handlers/reviewDismissed';
import reviewRequestRemovedHandler from './events/pr-handlers/reviewRequestRemoved';
import reviewRequestedHandler from './events/pr-handlers/reviewRequested';
import reviewSubmittedHandler from './events/pr-handlers/reviewSubmitted';
import status from './events/pr-handlers/status';
import synchronizeHandler from './events/pr-handlers/synchronize';
import repoEdited from './events/repository-handlers/repoEdited';

export default function initApp(app: Probot, appContext: AppContext): void {
  /* https://developer.github.com/webhooks/event-payloads/#organization */
  app.on(
    ['organization.member_added', 'organization.member_removed'],
    createHandlerOrgChange<EventPayloads.WebhookPayloadOrganization>(
      appContext,
      async (context, accountContext) => {
        await syncOrg(
          appContext.mongoStores,
          context.octokit,
          accountContext.account.installationId as number,
          context.payload.organization,
        );
      },
    ),
  );

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
      },
    ),
  );

  // Repo
  /* https://developer.github.com/webhooks/event-payloads/#repository */
  repoEdited(app, appContext);

  // PR
  /* https://developer.github.com/webhooks/event-payloads/#pull_request */
  openedHandler(app, appContext);
  editedHandler(app, appContext);
  closedHandler(app, appContext);
  reopenedHandler(app, appContext);

  reviewRequestedHandler(app, appContext);
  reviewRequestRemovedHandler(app, appContext);
  reviewSubmittedHandler(app, appContext);
  reviewDismissedHandler(app, appContext);
  labelsChanged(app, appContext);
  synchronizeHandler(app, appContext);

  /* https://developer.github.com/webhooks/event-payloads/#pull_request_review_comment */
  /* https://developer.github.com/webhooks/event-payloads/#issue_comment */
  commentCreated(app, appContext);
  commentEditedOrDeleted(app, appContext);

  /* https://developer.github.com/webhooks/event-payloads/#check_run */
  checkrunCompleted(app, appContext);

  /* https://developer.github.com/webhooks/event-payloads/#check_suite */
  checksuiteCompleted(app, appContext);

  /* https://developer.github.com/webhooks/event-payloads/#status */
  status(app, appContext);

  /* commands */
  // commands(app, 'update-branch', () => {});
}
