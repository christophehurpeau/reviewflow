import { Application } from 'probot';
import { AppContext } from '../../context/AppContext';
import { createPullRequestHandler } from './utils/createPullRequestHandler';
import { updateReviewStatus } from './actions/updateReviewStatus';
import { parseOptions } from './actions/utils/body/parseBody';

export default function closed(app: Application, appContext: AppContext): void {
  app.on(
    'pull_request.closed',
    createPullRequestHandler(
      appContext,
      (payload) => payload.pull_request,
      async (prContext, context, repoContext) => {
        const { pr, commentBody } = prContext;

        if (!repoContext.shouldIgnore) {
          const repo = context.payload.repository;

          if (pr.merged) {
            const isNotFork = pr.head.repo.id === repo.id;
            const options = parseOptions(
              commentBody,
              repoContext.config.prDefaultOptions,
            );

            await Promise.all([
              repoContext.removePrFromAutomergeQueue(
                context,
                pr.number,
                'pr closed',
              ),
              isNotFork && options.deleteAfterMerge
                ? context.github.git
                    .deleteRef(context.repo({ ref: `heads/${pr.head.ref}` }))
                    .catch(() => {})
                : undefined,
            ]);
          } else {
            await Promise.all([
              repoContext.removePrFromAutomergeQueue(
                context,
                pr.number,
                'pr closed',
              ),
              updateReviewStatus(prContext, context, 'dev', {
                remove: ['needsReview'],
              }),
            ]);
          }
        }

        if (pr.assignees) {
          pr.assignees.forEach((assignee) => {
            repoContext.slack.updateHome(assignee.login);
          });
        }
      },
    ),
  );
}
