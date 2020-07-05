import Webhooks from '@octokit/webhooks';
import { Application, Context } from 'probot';
import { AppContext } from '../../context/AppContext';
import { LockedMergePr } from '../../context/repoContext';
import { createPullRequestsHandler } from './utils/createPullRequestHandler';

const isSameBranch = (
  payload: Context<Webhooks.WebhookPayloadStatus>['payload'],
  lockedPr: LockedMergePr,
): boolean => {
  if (!lockedPr) return false;
  return !!payload.branches.find((b) => b.name === lockedPr.branch);
};

export default function status(app: Application, appContext: AppContext): void {
  app.on(
    'status',
    createPullRequestsHandler(
      appContext,
      (payload, repoContext): LockedMergePr[] => {
        const lockedPr = repoContext.getMergeLockedPr();
        if (!lockedPr) return [];

        if (payload.state !== 'loading' && isSameBranch(payload, lockedPr)) {
          return [lockedPr];
        }

        return [];
      },
      (pr, context, repoContext): void => {
        const lockedPr = repoContext.getMergeLockedPr();
        // check if changed
        if (isSameBranch(context.payload, lockedPr)) {
          repoContext.reschedule(context, lockedPr);
        }
      },
    ),
  );
}
