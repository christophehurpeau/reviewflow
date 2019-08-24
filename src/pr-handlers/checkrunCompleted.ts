import { Application } from 'probot';
import { createHandlerPullRequestsChange } from './utils';
import { autoMergeIfPossible } from './actions/autoMergeIfPossible';

export default function checkrunCompleted(app: Application): void {
  app.on(
    'check_run.completed',
    createHandlerPullRequestsChange(
      (context) => context.payload.check_run.pull_requests,
      async (context, repoContext) => {
        await Promise.all(
          context.payload.check_run.pull_requests.map((pr) =>
            context.github.pulls
              .get(
                context.repo({
                  number: pr.number,
                }),
              )
              .then((prResult) => {
                return autoMergeIfPossible(prResult.data, context, repoContext);
              }),
          ),
        );
      },
    ),
  );
}
