import { Application } from 'probot';
import { MongoStores } from '../mongo';
import { createHandlerPullRequestsChange } from './utils';
import { autoMergeIfPossible } from './actions/autoMergeIfPossible';

export default function checksuiteCompleted(
  app: Application,
  mongoStores: MongoStores,
): void {
  app.on(
    'check_suite.completed',
    createHandlerPullRequestsChange(
      mongoStores,
      (context) => context.payload.check_suite.pull_requests,
      async (context, repoContext) => {
        await Promise.all(
          context.payload.check_suite.pull_requests.map((pr) =>
            context.github.pulls
              .get(
                context.repo({
                  pull_number: pr.number,
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
