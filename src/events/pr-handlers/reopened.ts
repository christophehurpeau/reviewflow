import { Application } from 'probot';
import { AppContext } from '../../context/AppContext';
import { createPullRequestHandler } from './utils/createPullRequestHandler';
import { updateReviewStatus } from './actions/updateReviewStatus';
import { editOpenedPR } from './actions/editOpenedPR';

export default function closed(app: Application, appContext: AppContext): void {
  app.on(
    'pull_request.reopened',
    createPullRequestHandler(
      appContext,
      (payload) => payload.pull_request,
      async (prContext, context, repoContext): Promise<void> => {
        await Promise.all([
          updateReviewStatus(prContext, context, 'dev', {
            add: ['needsReview'],
            remove: ['approved'],
          }),
          editOpenedPR(prContext, context, true),
        ]);
      },
    ),
  );
}
