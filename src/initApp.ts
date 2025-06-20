import type { Probot } from "probot";
// import commands from 'probot-commands';
import type { AppContext } from "./context/AppContext.ts";
import membershipChanged from "./events/account-handlers/membershipChanged.ts";
import orgMemberAddedOrRemoved from "./events/account-handlers/orgMemberAddedOrRemoved.ts";
import teamChanged from "./events/account-handlers/teamChanged.ts";
import commitCommentCreated from "./events/commit-handlers/commitCommentCreated.ts";
import installation from "./events/installation-handlers/installation.ts";
import assignedOrUnassignedHandler from "./events/pr-handlers/assignedOrUnassigned.ts";
import autoMergeChangedHandler from "./events/pr-handlers/autoMergeChanged.ts";
import checkrunCompleted from "./events/pr-handlers/checkrun.ts";
import checksuiteCompleted from "./events/pr-handlers/checksuiteCompleted.ts";
import closedHandler from "./events/pr-handlers/closed.ts";
import commentCreated from "./events/pr-handlers/commentCreated.ts";
import commentEditedOrDeleted from "./events/pr-handlers/commentEditedOrDeleted.ts";
import convertedToDraft from "./events/pr-handlers/convertedToDraft.ts";
import editedHandler from "./events/pr-handlers/edited.ts";
import labelsChanged from "./events/pr-handlers/labelsChanged.ts";
import openedHandler from "./events/pr-handlers/opened.ts";
import pushHandler from "./events/pr-handlers/push.ts";
import readyForReview from "./events/pr-handlers/readyForReview.ts";
import reopenedHandler from "./events/pr-handlers/reopened.ts";
import reviewDismissedHandler from "./events/pr-handlers/reviewDismissed.ts";
import reviewRequestRemovedHandler from "./events/pr-handlers/reviewRequestRemoved.ts";
import reviewRequestedHandler from "./events/pr-handlers/reviewRequested.ts";
import reviewSubmittedHandler from "./events/pr-handlers/reviewSubmitted.ts";
import status from "./events/pr-handlers/status.ts";
import synchronizeHandler from "./events/pr-handlers/synchronize.ts";
import repoEdited from "./events/repository-handlers/repoEdited.ts";
import repoRenamed from "./events/repository-handlers/repoRenamed.ts";

export default function initApp(app: Probot, appContext: AppContext): void {
  // Installation
  /* https://developer.github.com/webhooks/event-payloads/#installation */
  installation(app, appContext);

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
