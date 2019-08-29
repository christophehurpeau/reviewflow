import { Application } from 'probot';
import { createHandlerPullRequestChange } from './utils';
import { updateReviewStatus } from './actions/updateReviewStatus';
import { readCommitsAndUpdateInfos } from './actions/readCommitsAndUpdateInfos';

export default function closed(app: Application): void {
  app.on(
    'pull_request.reopened',
    createHandlerPullRequestChange(
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
