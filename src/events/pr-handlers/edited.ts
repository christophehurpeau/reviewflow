import { Application } from 'probot';
import { AppContext } from '../../context/AppContext';
import { editOpenedPR } from './actions/editOpenedPR';
import { createHandlerPullRequestChange } from './utils';
import { autoMergeIfPossible } from './actions/autoMergeIfPossible';

export default function edited(app: Application, appContext: AppContext): void {
  app.on(
    'pull_request.edited',
    createHandlerPullRequestChange(
      appContext,
      { refetchPr: true },
      async (pr, context, repoContext): Promise<void> => {
        const sender = context.payload.sender;
        if (
          sender.type === 'Bot' &&
          sender.login === `${process.env.REVIEWFLOW_NAME}[bot]`
        ) {
          return;
        }

        const { skipAutoMerge } = await editOpenedPR(
          appContext,
          pr,
          context,
          repoContext,
        );
        if (!skipAutoMerge)
          await autoMergeIfPossible(appContext, pr, context, repoContext);
      },
    ),
  );
}
