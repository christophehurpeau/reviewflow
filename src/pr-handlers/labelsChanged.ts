import { Application } from 'probot';
import { handlerPullRequestChange } from './utils';

export default (app: Application) => {
  app.on(
    ['pull_request.labeled', 'pull_request.unlabeled'],
    async (context) => {
      const sender = context.payload.sender;
      if (sender.type === 'Bot') return;

      await handlerPullRequestChange(context, async (repoContext) => {
        await repoContext.updateStatusCheckFromLabels(context);
      });
    },
  );
};
