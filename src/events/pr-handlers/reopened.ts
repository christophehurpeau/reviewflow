import type { Probot } from 'probot';
import type { AppContext } from '../../context/AppContext';
import { editOpenedPR } from './actions/editOpenedPR';
import { updateReviewStatus } from './actions/updateReviewStatus';
import { createPullRequestHandler } from './utils/createPullRequestHandler';

export default function closed(app: Probot, appContext: AppContext): void {
  app.on(
    'pull_request.reopened',
    createPullRequestHandler(
      appContext,
      (payload, context, repoContext) => {
        if (repoContext.shouldIgnore) return null;
        return payload.pull_request;
      },
      async (
        pullRequest,
        context,
        repoContext,
        reviewflowPrContext,
      ): Promise<void> => {
        await Promise.all([
          updateReviewStatus(pullRequest, context, repoContext, 'dev', {
            add: ['needsReview'],
            remove: ['approved'],
          }),
          editOpenedPR(
            pullRequest,
            context,
            repoContext,
            reviewflowPrContext,
            true,
          ),
        ]);
      },
    ),
  );
}
