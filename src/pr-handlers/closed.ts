import { Application } from 'probot';
import { createHandlerPullRequestChange } from './utils';
import { updateReviewStatus } from './actions/updateReviewStatus';
import { parseBodyWithOptions } from './actions/utils/parseBody';

export default function closed(app: Application): void {
  app.on(
    'pull_request.closed',
    createHandlerPullRequestChange(
      async (pr, context, repoContext): Promise<void> => {
        const repo = context.payload.repository;

        if (pr.merged) {
          const parsedBody =
            pr.head.repo.id === repo.id &&
            parseBodyWithOptions(pr.body, repoContext.config.prDefaultOptions);

          await Promise.all([
            repoContext.removePrFromAutomergeQueue(context, pr.number),
            parsedBody && parsedBody.options.deleteAfterMerge
              ? context.github.git
                  .deleteRef(context.repo({ ref: `heads/${pr.head.ref}` }))
                  .catch(() => {})
              : undefined,
          ]);
        } else {
          await Promise.all([
            repoContext.removePrFromAutomergeQueue(context, pr.number),
            updateReviewStatus(pr, context, repoContext, 'dev', {
              remove: ['needsReview'],
            }),
          ]);
        }
      },
    ),
  );
}
