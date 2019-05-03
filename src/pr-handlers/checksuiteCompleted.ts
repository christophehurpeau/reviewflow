import { Application } from 'probot';
import { createHandlerPullRequestsChange } from './utils';
import { autoMergeIfPossible } from './actions/autoMergeIfPossible';

export default function checksuiteCompleted(app: Application): void {
  app.on(
    'check_suite.completed',
    createHandlerPullRequestsChange(
      (context) => context.payload.check_suite.pull_requests,
      async (context, repoContext) => {
        await Promise.all(
          context.payload.check_suite.pull_requests.map((pr) =>
            context.github.pulls
              .get(
                context.repo({
                  number: pr.number,
                }),
              )
              .then((prResult) => {
                return autoMergeIfPossible(context, repoContext, prResult.data);
              }),
          ),
        );
      },
    ),
  );
}
