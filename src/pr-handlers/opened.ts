import { Application } from 'probot';
import { createHandlerPullRequestChange } from './utils';
import { autoAssignPRToCreator } from './actions/autoAssignPRToCreator';
import { editOpenedPR } from './actions/editOpenedPR';
import { updateReviewStatus } from './actions/updateReviewStatus';
import { autoApproveAndAutoMerge } from './actions/autoApproveAndAutoMerge';

export default function opened(app: Application): void {
  app.on(
    'pull_request.opened',
    createHandlerPullRequestChange(
      async (context, repoContext): Promise<void> => {
        const fromRenovate = context.payload.pull_request.head.ref.startsWith(
          'renovate/',
        );

        await Promise.all<unknown>([
          autoAssignPRToCreator(context, repoContext),
          editOpenedPR(context, repoContext),
          fromRenovate
            ? autoApproveAndAutoMerge(context, repoContext).then(
                async (approved: boolean): Promise<void> => {
                  if (!approved) {
                    await updateReviewStatus(context, repoContext, 'dev', {
                      add: ['needsReview'],
                    });
                  }
                },
              )
            : updateReviewStatus(context, repoContext, 'dev', {
                add: ['needsReview'],
                remove: ['approved', 'changesRequested'],
              }),
        ]);
      },
    ),
  );
}
