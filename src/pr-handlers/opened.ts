import { Application } from 'probot';
import { createHandlerPullRequestChange } from './utils';
import { autoAssignPRToCreator } from './actions/autoAssignPRToCreator';
import { editOpenedPR } from './actions/editOpenedPR';
import { lintPR } from './actions/lintPR';

export default (app: Application) => {
  app.on(
    'pull_request.opened',
    createHandlerPullRequestChange(async (context, repoContext) => {
      await Promise.all([
        autoAssignPRToCreator(context, repoContext),
        editOpenedPR(context, repoContext),
        lintPR(context, repoContext),
        repoContext.updateReviewStatus(context, 'dev', {
          add: ['needsReview'],
        }),
      ]);
    }),
  );
};
