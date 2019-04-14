import { Application } from 'probot';
import { createHandlerPullRequestChange } from './utils';
import { updateReviewStatus } from './actions/updateReviewStatus';

export default (app: Application) => {
  app.on(
    'pull_request.closed',
    createHandlerPullRequestChange(async (context, repoContext) => {
      const pr = context.payload.pull_request;
      if (pr.merged) {
        const createMergeLockPrFromPr = () => ({
          id: pr.id,
          number: pr.number,
          branch: pr.head.ref,
        });
        await Promise.all([
          repoContext.removeMergeLockedPr(context, createMergeLockPrFromPr()),
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
