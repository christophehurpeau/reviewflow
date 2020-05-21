import { Application } from 'probot';
import { MongoStores } from '../mongo';
import { createHandlerPullRequestChange } from './utils';
import { editOpenedPR } from './actions/editOpenedPR';
import { updateStatusCheckFromLabels } from './actions/updateStatusCheckFromLabels';
import { autoMergeIfPossible } from './actions/autoMergeIfPossible';
import { readCommitsAndUpdateInfos } from './actions/readCommitsAndUpdateInfos';

export default function synchronize(
  app: Application,
  mongoStores: MongoStores,
): void {
  app.on(
    'pull_request.synchronize',
    createHandlerPullRequestChange(
      mongoStores,
      async (pr, context, repoContext): Promise<void> => {
        // old and new sha
        // const { before, after } = context.payload;
        const previousSha = (context.payload as any).before as string;

        await Promise.all([
          editOpenedPR(pr, context, repoContext, previousSha),
          // addStatusCheckToLatestCommit
          updateStatusCheckFromLabels(
            pr,
            context,
            repoContext,
            pr.labels,
            previousSha,
          ),

          readCommitsAndUpdateInfos(pr, context, repoContext),
        ]);

        // call autoMergeIfPossible to re-add to the queue when push is fixed
        await autoMergeIfPossible(pr, context, repoContext);
      },
    ),
  );
}
