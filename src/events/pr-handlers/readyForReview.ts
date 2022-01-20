import type { Probot } from 'probot';
import type { AppContext } from '../../context/AppContext';
import { editOpenedPR } from './actions/editOpenedPR';
import { updateReviewStatus } from './actions/updateReviewStatus';
import { createPullRequestHandler } from './utils/createPullRequestHandler';

export default function readyForReview(
  app: Probot,
  appContext: AppContext,
): void {
  createPullRequestHandler(
    app,
    appContext,
    'pull_request.ready_for_review',
    (payload, context, repoContext) => {
      return payload.pull_request;
    },
    async (
      pullRequest,
      context,
      repoContext,
      reviewflowPrContext,
    ): Promise<void> => {
      /* if repo is not ignored */
      if (reviewflowPrContext) {
        await Promise.all([
          updateReviewStatus(
            pullRequest,
            context,
            appContext,
            repoContext,
            reviewflowPrContext,
            'dev',
            {
              add: ['needsReview'],
            },
          ),
          editOpenedPR(
            pullRequest,
            context,
            appContext,
            repoContext,
            reviewflowPrContext,
            true,
          ),
        ]);
      }
    },
  );
}
