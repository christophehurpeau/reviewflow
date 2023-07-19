import type { Probot } from 'probot';
import type { AppContext } from '../../context/AppContext';
import type { LockedMergePr } from '../../context/repoContext';
import type { ProbotEvent } from '../probot-types';
import { calcAndUpdateChecksAndStatuses } from './actions/calcAndUpdateChecksAndStatuses';
import type { PullRequestDataMinimumData } from './utils/PullRequestData';
import { createPullRequestsHandler } from './utils/createPullRequestHandler';
import { fetchPr } from './utils/fetchPr';

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
      if (payload.context === process.env.REVIEWFLOW_NAME) return [];

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
    async (
      pullRequest,
      context,
      repoContext,
      reviewflowPrContext,
    ): Promise<void> => {
      if (context.payload.state !== 'pending') {
        await repoContext.rescheduleOnChecksUpdated(
          context,
          pullRequest,
          context.payload.state === 'success',
        );
      }

      if (reviewflowPrContext?.reviewflowPr.statusesConclusion) {
        const key = context.payload.context.replace(/[\s.]/g, '_');

        if (
          reviewflowPrContext.reviewflowPr.statusesConclusion[key]?.state ===
          context.payload.state
        ) {
          return;
        }

        reviewflowPrContext.reviewflowPr.statusesConclusion[key] = {
          state: context.payload.state,
          context: context.payload.context,
        };

        // TODO calc and update ci step state
        await Promise.all([
          fetchPr(context, pullRequest.number).then((pr) =>
            calcAndUpdateChecksAndStatuses(
              context,
              appContext,
              repoContext,
              pr,
              reviewflowPrContext,
            ),
          ),
          appContext.mongoStores.prs.partialUpdateOne(
            reviewflowPrContext.reviewflowPr,
            {
              $set: {
                [`statusesConclusion.${key}`]: {
                  context: context.payload.context,
                  state: context.payload.state,
                },
              } as any,
            },
          ),
        ]);
      }
    },
  );
}
