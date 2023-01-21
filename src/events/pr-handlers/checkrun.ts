import type { Probot } from 'probot';
import type { AppContext } from '../../context/AppContext';
import { calcAndUpdateLabels } from './actions/calcAndUpdateLabels';
import { createPullRequestsHandler } from './utils/createPullRequestHandler';
import { fetchPr } from './utils/fetchPr';

export default function checkrun(app: Probot, appContext: AppContext): void {
  createPullRequestsHandler(
    app,
    appContext,
    ['check_run.created', 'check_run.completed'],
    (payload, repoContext) => {
      if (repoContext.shouldIgnore) return [];
      return payload.check_run.pull_requests;
    },
    async (pullRequest, context, repoContext, reviewflowPrContext) => {
      const { action, check_run: checkRun } = context.payload;

      if (action === 'completed') {
        await repoContext.rescheduleOnChecksUpdated(
          context,
          pullRequest,
          checkRun.conclusion === 'success',
        );
      }

      if (reviewflowPrContext?.reviewflowPr.headSha !== checkRun.head_sha) {
        return;
      }

      if (reviewflowPrContext?.reviewflowPr.checksConclusion) {
        const checkConclusionKey =
          `${checkRun.check_suite?.id}_${checkRun.name}`.replace(/[\s.]/g, '_');
        if (
          reviewflowPrContext.reviewflowPr.checksConclusion[checkConclusionKey]
            ?.conclusion === checkRun.conclusion
        ) {
          return;
        }

        reviewflowPrContext.reviewflowPr.checksConclusion[checkConclusionKey] =
          { name: checkRun.name, conclusion: checkRun.conclusion as any };

        // TODO calc and update ci step state
        await Promise.all([
          fetchPr(context, pullRequest.number).then((pr) =>
            calcAndUpdateLabels(
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
                [`checksConclusion.${checkConclusionKey}`]:
                  reviewflowPrContext.reviewflowPr.checksConclusion[
                    checkConclusionKey
                  ],
              },
            },
          ),
        ]);
      }
    },
  );
}
