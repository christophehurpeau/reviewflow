import { Application } from 'probot';
import openedHandler from './pr-handlers/opened';
import closedHandler from './pr-handlers/closed';
import reopenedHandler from './pr-handlers/reopened';
import reviewRequestedHandler from './pr-handlers/reviewRequested';
import reviewRequestRemovedHandler from './pr-handlers/reviewRequestRemoved';
import reviewSubmittedHandler from './pr-handlers/reviewSubmitted';
import reviewDismissedHandler from './pr-handlers/reviewDismissed';
import synchromizeHandler from './pr-handlers/synchronize';
import editedHandler from './pr-handlers/edited';
import labelsChanged from './pr-handlers/labelsChanged';
import checkrunCompleted from './pr-handlers/checkrunCompleted';
import checksuiteCompleted from './pr-handlers/checksuiteCompleted';
import status from './pr-handlers/status';

export default function initApp(app: Application): void {
  openedHandler(app);
  closedHandler(app);
  reopenedHandler(app);
  reviewRequestedHandler(app);
  reviewRequestRemovedHandler(app);

  // app.on('pull_request.closed', async context => {

  // });

  // app.on('pull_request.reopened', async context => {

  // });

  reviewSubmittedHandler(app);
  reviewDismissedHandler(app);
  labelsChanged(app);
  synchromizeHandler(app);
  editedHandler(app);

  checkrunCompleted(app);
  checksuiteCompleted(app);
  status(app);
}
