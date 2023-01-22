import type { Probot } from 'probot';
// import commands from 'probot-commands';
import type { AppContext } from './context/AppContext';
import membershipChanged from './events/account-handlers/membershipChanged';
import orgMemberAddedOrRemoved from './events/account-handlers/orgMemberAddedOrRemoved';
import teamChanged from './events/account-handlers/teamChanged';
import commitCommentCreated from './events/commit-handlers/commitCommentCreated';
import assignedOrUnassignedHandler from './events/pr-handlers/assignedOrUnassigned';
import autoMergeChangedHandler from './events/pr-handlers/autoMergeChanged';
import checkrunCompleted from './events/pr-handlers/checkrun';
import checksuiteCompleted from './events/pr-handlers/checksuiteCompleted';
import closedHandler from './events/pr-handlers/closed';
import commentCreated from './events/pr-handlers/commentCreated';
import commentEditedOrDeleted from './events/pr-handlers/commentEditedOrDeleted';
import convertedToDraft from './events/pr-handlers/convertedToDraft';
import editedHandler from './events/pr-handlers/edited';
import labelsChanged from './events/pr-handlers/labelsChanged';
import openedHandler from './events/pr-handlers/opened';
import pushHandler from './events/pr-handlers/push';
import readyForReview from './events/pr-handlers/readyForReview';
import reopenedHandler from './events/pr-handlers/reopened';
import reviewDismissedHandler from './events/pr-handlers/reviewDismissed';
import reviewRequestRemovedHandler from './events/pr-handlers/reviewRequestRemoved';
import reviewRequestedHandler from './events/pr-handlers/reviewRequested';
import reviewSubmittedHandler from './events/pr-handlers/reviewSubmitted';
import status from './events/pr-handlers/status';
import synchronizeHandler from './events/pr-handlers/synchronize';
import repoEdited from './events/repository-handlers/repoEdited';
import repoRenamed from './events/repository-handlers/repoRenamed';

export default function initApp(app: Probot, appContext: AppContext): void {
  // Account
  /* https://developer.github.com/webhooks/event-payloads/#organization */
  /* https://developer.github.com/webhooks/event-payloads/#team */
  /* https://developer.github.com/webhooks/event-payloads/#membership */
  orgMemberAddedOrRemoved(app, appContext);
  teamChanged(app, appContext);
  membershipChanged(app, appContext);

  // Repo
  /* https://developer.github.com/webhooks/event-payloads/#repository */
  repoEdited(app, appContext);
  repoRenamed(app, appContext);

  // Push
  /* https://docs.github.com/en/developers/webhooks-and-events/webhooks/webhook-events-and-payloads#push */
  pushHandler(app, appContext);

  // Commit
  /* https://docs.github.com/en/developers/webhooks-and-events/webhooks/webhook-events-and-payloads#commit_comment */
  commitCommentCreated(app, appContext);

  // PR
  /* https://developer.github.com/webhooks/event-payloads/#pull_request */
  assignedOrUnassignedHandler(app, appContext);
  openedHandler(app, appContext);
  editedHandler(app, appContext);
  closedHandler(app, appContext);
  reopenedHandler(app, appContext);
  convertedToDraft(app, appContext);
  readyForReview(app, appContext);

  reviewRequestedHandler(app, appContext);
  reviewRequestRemovedHandler(app, appContext);
  reviewSubmittedHandler(app, appContext);
  reviewDismissedHandler(app, appContext);
  labelsChanged(app, appContext);
  synchronizeHandler(app, appContext);
  autoMergeChangedHandler(app, appContext);

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
