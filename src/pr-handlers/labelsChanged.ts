import { Application } from 'probot';
import { handlerPullRequestChange } from './utils';
import { autoMergeIfPossible } from './actions/autoMergeIfPossible';

export default (app: Application) => {
  app.on(
    ['pull_request.labeled', 'pull_request.unlabeled'],
    async (context) => {
      const sender = context.payload.sender;
      if (sender.type === 'Bot') return;

      await handlerPullRequestChange(context, async (repoContext) => {
        await repoContext.updateStatusCheckFromLabels(context);

        if (
          context.payload.action === 'labeled' &&
          context.payload.label.id ===
            (repoContext.labels['merge/automerge'] &&
              repoContext.labels['merge/automerge'].id)
        ) {
          await autoMergeIfPossible(context, repoContext, true);
        }
      });
    },
  );
};
