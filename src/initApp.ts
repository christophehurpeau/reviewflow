import { Application } from 'probot';
import Webhooks from '@octokit/webhooks';
import openedHandler from './pr-handlers/opened';
import closedHandler from './pr-handlers/closed';
import reopenedHandler from './pr-handlers/reopened';
import commentCreated from './pr-handlers/commentCreated';
import commentEditedOrDeleted from './pr-handlers/commentEditedOrDeleted';
import reviewRequestedHandler from './pr-handlers/reviewRequested';
import reviewRequestRemovedHandler from './pr-handlers/reviewRequestRemoved';
import reviewSubmittedHandler from './pr-handlers/reviewSubmitted';
import reviewDismissedHandler from './pr-handlers/reviewDismissed';
import synchronizeHandler from './pr-handlers/synchronize';
import editedHandler from './pr-handlers/edited';
import labelsChanged from './pr-handlers/labelsChanged';
import checkrunCompleted from './pr-handlers/checkrunCompleted';
import checksuiteCompleted from './pr-handlers/checksuiteCompleted';
import status from './pr-handlers/status';
import { createHandlerOrgChange } from './account-handlers/utils/handler';
import { syncOrg } from './account-handlers/actions/syncOrg';
import { syncTeams } from './account-handlers/actions/syncTeams';
import { AppContext } from './context/AppContext';

export default function initApp(
  app: Application,
  appContext: AppContext,
): void {
  /* https://developer.github.com/webhooks/event-payloads/#organization */
  app.on(
    ['organization.member_added', 'organization.member_removed'],
    createHandlerOrgChange<Webhooks.WebhookPayloadOrganization>(
      appContext,
      async (context, accountContext) => {
        await syncOrg(
          appContext.mongoStores,
          context.github,
          accountContext.account.installationId as number,
          context.payload.organization,
        );
      },
    ),
  );

  /* https://developer.github.com/webhooks/event-payloads/#team */
  app.on(
    ['team.created', 'team.deleted', 'team.edited'],
    createHandlerOrgChange<Webhooks.WebhookPayloadTeam>(
      appContext,
      async (context, accountContext) => {
        await syncTeams(
          appContext.mongoStores,
          context.github,
          context.payload.organization,
        );
      },
    ),
  );

  // /* https://developer.github.com/webhooks/event-payloads/#membership */
  // app.on(
  //   ['membership.added', 'membership.removed'],
  //   createHandlerOrgChange<Webhooks.WebhookPayloadMembership>(
  //     mongoStores,
  //     async (context, accountContext) => {
  //       await syncTeamMembers(
  //         mongoStores,
  //         context.github,
  //         context.payload.organization,
  //         context.payload.team,
  //       );
  //     },
  //   ),
  // );

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
}
