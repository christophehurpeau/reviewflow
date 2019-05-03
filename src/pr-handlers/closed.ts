import { Application } from 'probot';
import { createHandlerPullRequestChange } from './utils';
import { updateReviewStatus } from './actions/updateReviewStatus';
import { parseBody } from './actions/utils/parseBody';

export default function closed(app: Application): void {
  app.on(
    'pull_request.closed',
    createHandlerPullRequestChange(
      async (context, repoContext): Promise<void> => {
        const repo = context.payload.repository;
        const pr = context.payload.pull_request;

        if (pr.merged) {
          const parsedBody =
            pr.head.repo.id === repo.id &&
            parseBody(pr.body, repoContext.config.prDefaultOptions);
          const createMergeLockPrFromPr = () => ({
            id: pr.id,
            number: pr.number,
            branch: pr.head.ref,
          });
          await Promise.all([
            repoContext.removeMergeLockedPr(context, createMergeLockPrFromPr()),
            parsedBody && parsedBody.options.deleteAfterMerge
              ? context.github.git
                  .deleteRef(context.repo({ ref: `heads/${pr.head.ref}` }))
                  .catch(() => {})
              : undefined,
          ]);
        } else {
          await Promise.all([
            updateReviewStatus(context, repoContext, 'dev', {
              remove: ['needsReview'],
            }),
          ]);
        }
      },
    ),
  );
}
