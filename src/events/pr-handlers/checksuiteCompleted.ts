import type { Probot } from 'probot';
import type { AppContext } from '../../context/AppContext';
import { autoMergeIfPossible } from './actions/autoMergeIfPossible';
import { getReviewflowPrContext } from './utils/createPullRequestContext';
import { createPullRequestsHandler } from './utils/createPullRequestHandler';
import { fetchPr } from './utils/fetchPr';

export default function checksuiteCompleted(
  app: Probot,
  appContext: AppContext,
): void {
  createPullRequestsHandler(
    app,
    appContext,
    'check_suite.completed',
    (payload, repoContext) => {
      if (repoContext.shouldIgnore) return [];
      return payload.check_suite.pull_requests;
    },
    async (pullRequest, context, repoContext) => {
      const [updatedPr, reviewflowPrContext] = await Promise.all([
        fetchPr(context, pullRequest.number),
        getReviewflowPrContext(pullRequest.number, context, repoContext),
      ]);

      await autoMergeIfPossible(
        updatedPr,
        context,
        repoContext,
        reviewflowPrContext,
      );
    },
  );
}
