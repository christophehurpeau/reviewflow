import { Application } from 'probot';
import { createHandlerPullRequestChange } from './utils';
import { editOpenedPR } from './actions/editOpenedPR';
import { updateStatusCheckFromLabels } from './actions/updateStatusCheckFromLabels';
import { autoMergeIfPossible } from './actions/autoMergeIfPossible';
import { readCommitsAndUpdateInfos } from './actions/readCommitsAndUpdateInfos';

export default function synchronize(app: Application): void {
  app.on(
    'pull_request.synchronize',
    createHandlerPullRequestChange(
      async (pr, context, repoContext): Promise<void> => {
        // old and new sha
        // const { before, after } = context.payload;

        await Promise.all([
          editOpenedPR(pr, context, repoContext),
          // addStatusCheckToLatestCommit
          updateStatusCheckFromLabels(pr, context, repoContext),

          readCommitsAndUpdateInfos(pr, context, repoContext),
        ]);

        // call autoMergeIfPossible to re-add to the queue when push is fixed
        await autoMergeIfPossible(pr, context, repoContext);
      },
    ),
  );
}
