import type { Probot } from 'probot';
import type { ProbotEvent } from 'events/probot-types';
import type { AppContext } from '../../context/AppContext';
import type { LockedMergePr } from '../../context/repoContext';
import { createPullRequestsHandler } from './utils/createPullRequestHandler';

const isSameBranch = (
  payload: ProbotEvent<'status'>['payload'],
  lockedPr: LockedMergePr,
): boolean => {
  if (!lockedPr) return false;
  return !!payload.branches.some((b) => b.name === lockedPr.branch);
};

export default function status(app: Probot, appContext: AppContext): void {
  createPullRequestsHandler(
    app,
    appContext,
    'status',
    (payload, repoContext): LockedMergePr[] => {
      if (repoContext.shouldIgnore) return [];

      const lockedPr = repoContext.getMergeLockedPr();
      if (!lockedPr) return [];

      if (payload.state !== 'pending' && isSameBranch(payload, lockedPr)) {
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
  );
}
