import { Application } from 'probot';
import { createHandlerPullRequestChange } from './utils';
import { autoAssignPRToCreator } from './actions/autoAssignPRToCreator';
import { editOpenedPR } from './actions/editOpenedPR';
import { lintPR } from './actions/lintPR';
import { updateReviewStatus } from './actions/updateReviewStatus';

export default (app: Application) => {
  app.on(
    'pull_request.opened',
    createHandlerPullRequestChange(async (context, repoContext) => {
      await Promise.all([
        autoAssignPRToCreator(context, repoContext),
        editOpenedPR(context, repoContext),
        lintPR(context, repoContext),
        updateReviewStatus(context, repoContext, 'dev', {
          add: ['needsReview'],
        }),
      ]);
    }),
  );
};
