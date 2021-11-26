import type { Probot } from 'probot';
import type { AppContext } from '../../context/AppContext';
import { editOpenedPR } from './actions/editOpenedPR';
import { updateReviewStatus } from './actions/updateReviewStatus';
import { createPullRequestHandler } from './utils/createPullRequestHandler';

export default function convertedToDraft(
  app: Probot,
  appContext: AppContext,
): void {
  createPullRequestHandler(
    app,
    appContext,
    'pull_request.converted_to_draft',
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
          updateReviewStatus(pullRequest, context, repoContext, 'dev', {
            remove: ['needsReview'],
          }),
          editOpenedPR(
            pullRequest,
            context,
            repoContext,
            reviewflowPrContext,
            true,
          ),
        ]);
      }
    },
  );
}