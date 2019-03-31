import { Application } from 'probot';
import { lintPR } from './actions/lintPR';
import { editOpenedPR } from './actions/editOpenedPR';
import { createHandlerPullRequestChange } from './utils';

export default (app: Application) => {
  app.on(
    'pull_request.edited',
    createHandlerPullRequestChange(async (context, repoContext) => {
      await Promise.all([
        editOpenedPR(context, repoContext),
        lintPR(context, repoContext),
      ]);
    }),
  );
};
