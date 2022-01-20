import type { Probot } from 'probot';
import type { AppContext } from '../../context/AppContext';
import { autoMergeIfPossible } from './actions/autoMergeIfPossible';
import { editOpenedPR } from './actions/editOpenedPR';
import { createPullRequestHandler } from './utils/createPullRequestHandler';
import { fetchPr } from './utils/fetchPr';
import { checkIfIsThisBot } from './utils/isBotUser';

export default function edited(app: Probot, appContext: AppContext): void {
  createPullRequestHandler(
    app,
    appContext,
    'pull_request.edited',
    (payload, context, repoContext) => {
      if (repoContext.shouldIgnore) return null;
      return payload.pull_request;
    },
    async (
      pullRequest,
      context,
      repoContext,
      reviewflowPrContext,
    ): Promise<void> => {
      if (reviewflowPrContext == null) return;

      const sender = context.payload.sender;
      if (checkIfIsThisBot(sender)) {
        return;
      }

      const updatedPullRequest = await fetchPr(
        context,
        context.payload.pull_request.number,
      );

      await editOpenedPR(
        updatedPullRequest,
        context,
        appContext,
        repoContext,
        reviewflowPrContext,
        false,
      );
      await autoMergeIfPossible(
        updatedPullRequest,
        context,
        repoContext,
        reviewflowPrContext,
      );
    },
  );
}
