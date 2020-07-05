import { Application } from 'probot';
import { AppContext } from 'context/AppContext';
import { createPullRequestHandler } from './utils/createPullRequestHandler';
import { autoAssignPRToCreator } from './actions/autoAssignPRToCreator';
import { editOpenedPR } from './actions/editOpenedPR';
import { updateReviewStatus } from './actions/updateReviewStatus';
import { autoApproveAndAutoMerge } from './actions/autoApproveAndAutoMerge';
import { defaultCommentBody } from './actions/utils/body/updateBody';
import { createReviewflowComment } from './utils/reviewflowComment';

export default function opened(app: Application, appContext: AppContext): void {
  app.on(
    'pull_request.opened',
    createPullRequestHandler(
      appContext,
      (payload) => payload.pull_request,
      async (prContext, context) => {
        const { pr } = prContext;
        const fromRenovate = pr.head.ref.startsWith('renovate/');

        await Promise.all<unknown>([
          autoAssignPRToCreator(prContext, context),
          editOpenedPR(prContext, context, true),
          fromRenovate
            ? autoApproveAndAutoMerge(prContext, context).then(
                async (approved: boolean): Promise<void> => {
                  if (!approved) {
                    await updateReviewStatus(prContext, context, 'dev', {
                      add: ['needsReview'],
                    });
                  }
                },
              )
            : updateReviewStatus(prContext, context, 'dev', {
                add: ['needsReview'],
                remove: ['approved', 'changesRequested'],
              }),
        ]);
      },
      (pr, context, repoContext) => {
        return {
          reviewflowCommentPromise: createReviewflowComment(
            context,
            pr,
            defaultCommentBody,
          ),
        };
      },
    ),
  );
}
