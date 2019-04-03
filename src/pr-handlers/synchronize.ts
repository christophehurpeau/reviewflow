import { Application } from 'probot';
import { createHandlerPullRequestChange } from './utils';
import { editOpenedPR } from './actions/editOpenedPR';
import { lintPR } from './actions/lintPR';
import { updateStatusCheckFromLabels } from './actions/updateStatusCheckFromLabels';

export default (app: Application) => {
  app.on(
    'pull_request.synchronize',
    createHandlerPullRequestChange(async (context, repoContext) => {
      // old and new sha
      // const { before, after } = context.payload;

      await Promise.all([
        editOpenedPR(context, repoContext),
        lintPR(context, repoContext),
        // addStatusCheckToLatestCommit
        updateStatusCheckFromLabels(context, repoContext),
      ]);
    }),
  );
};
