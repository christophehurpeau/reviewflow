import { Application } from 'probot';
import { createHandlerPullRequestsChange } from './utils';
import { autoMergeIfPossible } from './actions/autoMergeIfPossible';

export default (app: Application) => {
  app.on(
    'check_run.completed',
    createHandlerPullRequestsChange(
      (context) => context.payload.check_run.pull_requests,
      async (context, repoContext) => {
        console.log(
          'check_run.completed',
          context.payload.check_run.pull_requests,
        );
        await Promise.all(
          context.payload.check_run.pull_requests.map((pr) =>
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
};
