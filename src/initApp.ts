import { Application } from 'probot';
import Webhooks from '@octokit/webhooks';
import openedHandler from './pr-handlers/opened';
import closedHandler from './pr-handlers/closed';
import reopenedHandler from './pr-handlers/reopened';
import comment from './pr-handlers/comment';
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
import { MongoStores } from './mongo';
import { createHandlerOrgChange } from './org-handlers/utils/handler';
import { syncOrg } from './org-handlers/actions/syncOrg';
import { syncTeams } from './org-handlers/actions/syncTeams';

export default function initApp(
  app: Application,
  mongoStores: MongoStores,
): void {
  /* https://developer.github.com/webhooks/event-payloads/#organization */
  app.on(
    ['organization.member_added', 'organization.member_removed'],
    createHandlerOrgChange<Webhooks.WebhookPayloadOrganization>(
      mongoStores,
      async (context, orgContext) => {
        await syncOrg(
          mongoStores,
          context.github,
          context.payload.organization,
        );
      },
    ),
  );

  /* https://developer.github.com/webhooks/event-payloads/#team */
  app.on(
    ['team.created', 'team.deleted', 'team.edited'],
    createHandlerOrgChange<Webhooks.WebhookPayloadTeam>(
      mongoStores,
      async (context, orgContext) => {
        await syncTeams(
          mongoStores,
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
  //     async (context, orgContext) => {
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
  openedHandler(app, mongoStores);
  editedHandler(app, mongoStores);
  closedHandler(app, mongoStores);
  reopenedHandler(app, mongoStores);

  reviewRequestedHandler(app, mongoStores);
  reviewRequestRemovedHandler(app, mongoStores);
  reviewSubmittedHandler(app, mongoStores);
  reviewDismissedHandler(app, mongoStores);
  labelsChanged(app, mongoStores);
  synchronizeHandler(app, mongoStores);

  /* https://developer.github.com/webhooks/event-payloads/#pull_request_review_comment */
  comment(app, mongoStores);

  /* https://developer.github.com/webhooks/event-payloads/#check_run */
  checkrunCompleted(app, mongoStores);

  /* https://developer.github.com/webhooks/event-payloads/#check_suite */
  checksuiteCompleted(app, mongoStores);

  /* https://developer.github.com/webhooks/event-payloads/#status */
  status(app, mongoStores);
}
