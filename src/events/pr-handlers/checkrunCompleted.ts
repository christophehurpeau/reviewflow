import type { Probot } from 'probot';
import type { AppContext } from '../../context/AppContext';
import { createPullRequestsHandler } from './utils/createPullRequestHandler';

export default function checkrunCompleted(
  app: Probot,
  appContext: AppContext,
): void {
  createPullRequestsHandler(
    app,
    appContext,
    'check_run.completed',
    (payload, repoContext) => {
      if (repoContext.shouldIgnore) return [];
      return payload.check_run.pull_requests;
    },
    async (pullRequest, context, repoContext) => {
      await repoContext.rescheduleOnChecksUpdated(
        context,
        pullRequest,
        context.payload.check_run.conclusion === 'success',
      );
    },
  );
}
