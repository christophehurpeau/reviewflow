import { Application } from 'probot';
import { AppContext } from '../../context/AppContext';
import { editOpenedPR } from './actions/editOpenedPR';
import { createPullRequestHandler } from './utils/createPullRequestHandler';
import { autoMergeIfPossible } from './actions/autoMergeIfPossible';
import { fetchPullRequestAndCreateContext } from './utils/createPullRequestContext';
import { checkIfIsThisBot } from './utils/isBotUser';

export default function edited(app: Application, appContext: AppContext): void {
  app.on(
    'pull_request.edited',
    createPullRequestHandler(
      appContext,
      (payload) => payload.pull_request,
      async (prContext, context, repoContext): Promise<void> => {
        const prContextUpdated = await fetchPullRequestAndCreateContext(
          context,
          prContext,
        );
        const sender = context.payload.sender;
        if (checkIfIsThisBot(sender)) {
          return;
        }

        await editOpenedPR(prContextUpdated, context, false);
        await autoMergeIfPossible(prContextUpdated, context);
      },
    ),
  );
}
