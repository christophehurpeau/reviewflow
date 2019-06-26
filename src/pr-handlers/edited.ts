import { Application } from 'probot';
import { editOpenedPR } from './actions/editOpenedPR';
import { createHandlerPullRequestChange } from './utils';
import { autoMergeIfPossible } from './actions/autoMergeIfPossible';

export default function edited(app: Application): void {
  app.on(
    'pull_request.edited',
    createHandlerPullRequestChange(
      async (context, repoContext): Promise<void> => {
        const sender = context.payload.sender;
        if (sender.type === 'Bot') {
          return;
        }

        await editOpenedPR(context, repoContext);
        await autoMergeIfPossible(context, repoContext);
      },
    ),
  );
}
