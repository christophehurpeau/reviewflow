import type { Probot } from 'probot';
import type { AppContext } from '../../context/AppContext';
import { checkIfIsThisBot } from '../../utils/github/isBotUser';
import { autoMergeIfPossible } from './actions/autoMergeIfPossible';
import { editOpenedPR } from './actions/editOpenedPR';
import { updateStatusCheckFromLabels } from './actions/updateStatusCheckFromLabels';
import { createPullRequestHandler } from './utils/createPullRequestHandler';
import { fetchPr } from './utils/fetchPr';

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

      await Promise.all([
        editOpenedPR({
          pullRequest: updatedPullRequest,
          context,
          appContext,
          repoContext,
          reviewflowPrContext,
          shouldUpdateCommentBodyInfos: true,
        }),
        updateStatusCheckFromLabels(
          updatedPullRequest,
          context,
          appContext,
          repoContext,
          reviewflowPrContext,
          updatedPullRequest.labels,
        ),
      ]);

      await autoMergeIfPossible(
        updatedPullRequest,
        context,
        repoContext,
        reviewflowPrContext,
      );
    },
  );
}
