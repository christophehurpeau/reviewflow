import { Application } from 'probot';
import { AppContext } from '../../context/AppContext';
import { createPullRequestsHandler } from './utils/createPullRequestHandler';
import { autoMergeIfPossibleOptionalPrContext } from './actions/autoMergeIfPossible';
import { fetchPr } from './utils/fetchPr';

export default function checkrunCompleted(
  app: Application,
  appContext: AppContext,
): void {
  app.on(
    'check_run.completed',
    createPullRequestsHandler(
      appContext,
      (payload, repoContext) => {
        if (repoContext.shouldIgnore) return [];
        return payload.check_run.pull_requests;
      },
      async (pr, context, repoContext) => {
        const pullRequest = await fetchPr(context, pr.number);

        await autoMergeIfPossibleOptionalPrContext(
          appContext,
          repoContext,
          pullRequest,
          context,
        );
      },
    ),
  );
}
