import type { Probot } from 'probot';
import type { AppContext } from '../../context/AppContext';
import { updateReviewStatus } from './actions/updateReviewStatus';
import { parseOptions } from './actions/utils/body/parseBody';
import { createPullRequestHandler } from './utils/createPullRequestHandler';

export default function closed(app: Probot, appContext: AppContext): void {
  app.on(
    'pull_request.closed',
    createPullRequestHandler(
      appContext,
      (payload) => payload.pull_request,
      async (pullRequest, context, repoContext, reviewflowPrContext) => {
        if (!repoContext.shouldIgnore && reviewflowPrContext) {
          const repo = context.payload.repository;

          if (pullRequest.merged) {
            const isNotFork = pullRequest.head.repo.id === repo.id;
            const options = parseOptions(
              reviewflowPrContext.commentBody,
              repoContext.config.prDefaultOptions,
            );

            await Promise.all([
              repoContext.removePrFromAutomergeQueue(
                context,
                pullRequest.number,
                'pr closed',
              ),
              isNotFork && options.deleteAfterMerge
                ? context.octokit.git
                    .deleteRef(
                      context.repo({ ref: `heads/${pullRequest.head.ref}` }),
                    )
                    .catch(() => {})
                : undefined,
            ]);
          } else {
            await Promise.all([
              repoContext.removePrFromAutomergeQueue(
                context,
                pullRequest.number,
                'pr closed',
              ),
              updateReviewStatus(pullRequest, context, repoContext, 'dev', {
                remove: ['needsReview'],
              }),
            ]);
          }
        }

        if (pullRequest.assignees) {
          pullRequest.assignees.forEach((assignee) => {
            repoContext.slack.updateHome(assignee.login);
          });
        }
      },
    ),
  );
}
