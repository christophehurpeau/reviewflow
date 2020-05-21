import { Application } from 'probot';
import { MongoStores } from '../mongo';
import { createHandlerPullRequestChange } from './utils';
import { updateReviewStatus } from './actions/updateReviewStatus';
import { readCommitsAndUpdateInfos } from './actions/readCommitsAndUpdateInfos';

export default function closed(
  app: Application,
  mongoStores: MongoStores,
): void {
  app.on(
    'pull_request.reopened',
    createHandlerPullRequestChange(
      mongoStores,
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
