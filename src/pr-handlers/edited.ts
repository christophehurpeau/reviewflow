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
        if (
          sender.type === 'Bot' &&
          sender.login === `${process.env.REVIEWFLOW_NAME}[bot]`
        ) {
          return;
        }

        const { skipAutoMerge } = await editOpenedPR(context, repoContext);
        if (!skipAutoMerge) await autoMergeIfPossible(context, repoContext);
      },
    ),
  );
}
