import { Application } from 'probot';
import { AppContext } from '../../context/AppContext';
import { createPullRequestsHandler } from './utils/createPullRequestHandler';
import { autoMergeIfPossible } from './actions/autoMergeIfPossible';
import { fetchPr } from './utils/fetchPr';
import { createPullRequestContextFromPullResponse } from './utils/createPullRequestContext';

export default function checksuiteCompleted(
  app: Application,
  appContext: AppContext,
): void {
  app.on(
    'check_suite.completed',
    createPullRequestsHandler(
      appContext,
      (payload) => payload.check_suite.pull_requests,
      async (pr, context, repoContext) => {
        const pullRequest = await fetchPr(context, pr.number);
        const prContext = await createPullRequestContextFromPullResponse(
          appContext,
          repoContext,
          context,
          pullRequest,
          {},
        );

        await autoMergeIfPossible(prContext, context);
      },
    ),
  );
}
