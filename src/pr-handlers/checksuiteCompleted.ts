import { Application } from 'probot';
import { createHandlerPullRequestChange } from './utils';
import { autoMergeIfPossible } from './actions/autoMergeIfPossible';

export default (app: Application) => {
  app.on(
    ['check_suite.completed'],
    createHandlerPullRequestChange(async (context, repoContext) => {
      await autoMergeIfPossible(context, repoContext);
    }),
  );
};
