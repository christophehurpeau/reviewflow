import type { Probot } from 'probot';
import type { AppContext } from 'context/AppContext';
import { autoApproveAndAutoMerge } from './actions/autoApproveAndAutoMerge';
import { autoAssignPRToCreator } from './actions/autoAssignPRToCreator';
import { editOpenedPR } from './actions/editOpenedPR';
import { updateReviewStatus } from './actions/updateReviewStatus';
import { defaultCommentBody } from './actions/utils/body/updateBody';
import { createPullRequestHandler } from './utils/createPullRequestHandler';
import { fetchPr } from './utils/fetchPr';
import { createReviewflowComment } from './utils/reviewflowComment';

export default function opened(app: Probot, appContext: AppContext): void {
  app.on(
    'pull_request.opened',
    createPullRequestHandler(
      appContext,
      (payload, context, repoContext) => {
        if (repoContext.shouldIgnore) return null;
        return payload.pull_request;
      },
      async (pullRequest, context, repoContext, reviewflowPrContext) => {
        if (reviewflowPrContext === null) return;
        const fromRenovate = pullRequest.head.ref.startsWith('renovate/');

        await Promise.all<unknown>([
          autoAssignPRToCreator(pullRequest, context, repoContext),
          editOpenedPR(
            pullRequest,
            context,
            repoContext,
            reviewflowPrContext,
            true,
          ),
          fromRenovate
            ? fetchPr(context, pullRequest.number).then((updatedPr) =>
                autoApproveAndAutoMerge(
                  updatedPr,
                  context,
                  repoContext,
                  reviewflowPrContext,
                ).then(
                  async (approved: boolean): Promise<void> => {
                    if (!approved) {
                      await updateReviewStatus(
                        pullRequest,
                        context,
                        repoContext,
                        'dev',
                        {
                          add: ['needsReview'],
                        },
                      );
                    }
                  },
                ),
              )
            : updateReviewStatus(pullRequest, context, repoContext, 'dev', {
                add: repoContext.config.requiresReviewRequest
                  ? ['needsReview']
                  : [],
                remove: ['approved', 'changesRequested'],
              }),
        ]);
      },
      (pullRequest, context, repoContext) => {
        return {
          reviewflowCommentPromise: createReviewflowComment(
            pullRequest.number,
            context,
            defaultCommentBody,
          ),
        };
      },
    ),
  );
}
