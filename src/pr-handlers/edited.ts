import { Application } from 'probot';
import { MongoStores } from '../mongo';
import { editOpenedPR } from './actions/editOpenedPR';
import { createHandlerPullRequestChange } from './utils';
import { autoMergeIfPossible } from './actions/autoMergeIfPossible';

export default function edited(
  app: Application,
  mongoStores: MongoStores,
): void {
  app.on(
    'pull_request.edited',
    createHandlerPullRequestChange(
      mongoStores,
      async (pr, context, repoContext): Promise<void> => {
        const sender = context.payload.sender;
        if (
          sender.type === 'Bot' &&
          sender.login === `${process.env.REVIEWFLOW_NAME}[bot]`
        ) {
          return;
        }

        const { skipAutoMerge } = await editOpenedPR(pr, context, repoContext);
        if (!skipAutoMerge) await autoMergeIfPossible(pr, context, repoContext);
      },
    ),
  );
}
