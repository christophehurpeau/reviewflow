import { Application } from 'probot';
import { AppContext } from '../../context/AppContext';
import { createHandlerPullRequestChange } from './utils';
import { updateReviewStatus } from './actions/updateReviewStatus';
import { readCommitsAndUpdateInfos } from './actions/readCommitsAndUpdateInfos';

export default function closed(app: Application, appContext: AppContext): void {
  app.on(
    'pull_request.reopened',
    createHandlerPullRequestChange(
      appContext,
      { refetchPr: true },
      async (pr, context, repoContext): Promise<void> => {
        await Promise.all([
          updateReviewStatus(pr, context, repoContext, 'dev', {
            add: ['needsReview'],
            remove: ['approved'],
          }),
          readCommitsAndUpdateInfos(pr, context, repoContext),
        ]);
      },
    ),
  );
}
