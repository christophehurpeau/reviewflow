import type { Probot } from 'probot';
import type { ProbotEvent } from 'events/probot-types';
import type { AppContext } from '../../context/AppContext';
import type { LockedMergePr } from '../../context/repoContext';
import type { PullRequestDataMinimumData } from './utils/PullRequestData';
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
    async (payload, repoContext): Promise<PullRequestDataMinimumData[]> => {
      if (repoContext.shouldIgnore) return [];
      if (payload.state === 'pending') return [];

      const lockedPr = repoContext.getMergeLockedPr();

      if (lockedPr && isSameBranch(payload, lockedPr)) {
        return [lockedPr];
      }

      const prsForShaCursor = await appContext.mongoStores.prs.findAll({
        'account.id': repoContext.accountEmbed.id,
        'repo.id': repoContext.repoEmbed.id,
        headSha: payload.commit.sha,
      });

      return prsForShaCursor.map((reviewflowPr) => reviewflowPr.pr);
    },
    async (pullRequest, context, repoContext): Promise<void> => {
      await repoContext.rescheduleOnChecksUpdated(
        context,
        pullRequest,
        context.payload.state === 'success',
      );
    },
  );
}
