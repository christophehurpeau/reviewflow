import Webhooks from '@octokit/webhooks';
import { Application, Context } from 'probot';
import { LockedMergePr } from '../context/repoContext';
import { createHandlerPullRequestsChange } from './utils';

const isSameBranch = (
  context: Context<Webhooks.WebhookPayloadStatus>,
  lockedPr: LockedMergePr,
) => {
  if (!lockedPr) return false;
  return context.payload.branches.find((b) => b.name === lockedPr.branch);
};

export default (app: Application) => {
  app.on(
    'status',
    createHandlerPullRequestsChange(
      (context, repoContext) => {
        const lockedPr = repoContext.getMergeLockedPr();
        if (!lockedPr) return [];

        if (isSameBranch(context, lockedPr)) {
          return [lockedPr];
        }

        return [];
      },
      (context, repoContext) => {
        const lockedPr = repoContext.getMergeLockedPr();
        // check if changed
        if (isSameBranch(context, lockedPr)) {
          repoContext.reschedule(context, lockedPr);
        }
      },
    ),
  );
};
