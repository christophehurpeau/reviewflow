import { Application } from 'probot';
import { createHandlerPullRequestChange } from './utils';
import { autoAssignPRToCreator } from './actions/autoAssignPRToCreator';
import { editOpenedPR } from './actions/editOpenedPR';
import { updateReviewStatus } from './actions/updateReviewStatus';

export default function opened(app: Application): void {
  app.on(
    'pull_request.opened',
    createHandlerPullRequestChange(
      async (context, repoContext): Promise<void> => {
        await Promise.all([
          autoAssignPRToCreator(context, repoContext),
          editOpenedPR(context, repoContext),
          context.payload.pull_request.head.ref.startsWith('renovate/')
            ? Promise.resolve(undefined)
            : updateReviewStatus(context, repoContext, 'dev', {
                add: ['needsReview'],
              }),
        ]);
      },
    ),
  );
}
