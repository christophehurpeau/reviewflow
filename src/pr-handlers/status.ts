import Webhooks from '@octokit/webhooks';
import { Application, Context } from 'probot';
import { MongoStores } from '../mongo';
import { LockedMergePr } from '../context/repoContext';
import { createHandlerPullRequestsChange } from './utils';

const isSameBranch = (
  context: Context<Webhooks.WebhookPayloadStatus>,
  lockedPr: LockedMergePr,
): boolean => {
  if (!lockedPr) return false;
  return !!context.payload.branches.find((b) => b.name === lockedPr.branch);
};

export default function status(
  app: Application,
  mongoStores: MongoStores,
): void {
  app.on(
    'status',
    createHandlerPullRequestsChange(
      mongoStores,
      (context, repoContext): LockedMergePr[] => {
        const lockedPr = repoContext.getMergeLockedPr();
        if (!lockedPr) return [];

        if (
          context.payload.state !== 'loading' &&
          isSameBranch(context, lockedPr)
        ) {
          return [lockedPr];
        }

        return [];
      },
      (context, repoContext): void => {
        const lockedPr = repoContext.getMergeLockedPr();
        // check if changed
        if (isSameBranch(context, lockedPr)) {
          repoContext.reschedule(context, lockedPr);
        }
      },
    ),
  );
}
