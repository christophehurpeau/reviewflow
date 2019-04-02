import { Application } from 'probot';
import { createHandlerPullRequestChange } from './utils';
import { editOpenedPR } from './actions/editOpenedPR';
import { lintPR } from './actions/lintPR';

export default (app: Application) => {
  app.on(
    'pull_request.synchronize',
    createHandlerPullRequestChange(async (context, repoContext) => {
      await Promise.all([
        editOpenedPR(context, repoContext),
        lintPR(context, repoContext),
        repoContext.addStatusCheckToLatestCommit(context),
      ]);
    }),
  );
};
