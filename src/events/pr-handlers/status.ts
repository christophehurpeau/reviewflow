import type { EventPayloads } from '@octokit/webhooks';
import type { Probot, Context } from 'probot';
import type { AppContext } from '../../context/AppContext';
import type { LockedMergePr } from '../../context/repoContext';
import { createPullRequestsHandler } from './utils/createPullRequestHandler';

const isSameBranch = (
  payload: Context<EventPayloads.WebhookPayloadStatus>['payload'],
  lockedPr: LockedMergePr,
): boolean => {
  if (!lockedPr) return false;
  return !!payload.branches.find((b) => b.name === lockedPr.branch);
};

export default function status(app: Probot, appContext: AppContext): void {
  app.on(
    'status',
    createPullRequestsHandler(
      appContext,
      (payload, repoContext): LockedMergePr[] => {
        if (repoContext.shouldIgnore) return [];

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
