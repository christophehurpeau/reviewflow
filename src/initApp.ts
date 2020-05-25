import { Application } from 'probot';
import Webhooks from '@octokit/webhooks';
import openedHandler from './events/pr-handlers/opened';
import closedHandler from './events/pr-handlers/closed';
import reopenedHandler from './events/pr-handlers/reopened';
import commentCreated from './events/pr-handlers/commentCreated';
import commentEditedOrDeleted from './events/pr-handlers/commentEditedOrDeleted';
import reviewRequestedHandler from './events/pr-handlers/reviewRequested';
import reviewRequestRemovedHandler from './events/pr-handlers/reviewRequestRemoved';
import reviewSubmittedHandler from './events/pr-handlers/reviewSubmitted';
import reviewDismissedHandler from './events/pr-handlers/reviewDismissed';
import synchronizeHandler from './events/pr-handlers/synchronize';
import editedHandler from './events/pr-handlers/edited';
import labelsChanged from './events/pr-handlers/labelsChanged';
import checkrunCompleted from './events/pr-handlers/checkrunCompleted';
import checksuiteCompleted from './events/pr-handlers/checksuiteCompleted';
import status from './events/pr-handlers/status';
import { createHandlerOrgChange } from './events/account-handlers/utils/handler';
import repoEdited from './events/repository-handlers/repoEdited';
import { syncOrg } from './events/account-handlers/actions/syncOrg';
import { syncTeams } from './events/account-handlers/actions/syncTeams';
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
}
