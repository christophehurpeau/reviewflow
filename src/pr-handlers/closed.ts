import { Application } from 'probot';
import { createHandlerPullRequestChange } from './utils';
import { updateReviewStatus } from './actions/updateReviewStatus';

export default (app: Application) => {
  app.on(
    'pull_request.closed',
    createHandlerPullRequestChange(async (context, repoContext) => {
      const pr = context.payload.pull_request;
      if (pr.merged) {
        await Promise.all([
          repoContext.removeMergeLocked(context, pr.number),
          // TODO delete branch
        ]);
      } else {
        await Promise.all([
          updateReviewStatus(context, repoContext, 'dev', {
            remove: ['needsReview'],
          }),
        ]);
      }
    }),
  );
};
