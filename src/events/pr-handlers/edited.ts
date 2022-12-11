import type { Probot } from 'probot';
import type { AppContext } from '../../context/AppContext';
import { checkIfIsThisBot } from '../../utils/github/isBotUser';
import { autoMergeIfPossible } from './actions/autoMergeIfPossible';
import { editOpenedPR } from './actions/editOpenedPR';
import { updateStatusCheckFromStepsState } from './actions/updateStatusCheckFromStepsState';
import { calcStepsState } from './actions/utils/steps/calcStepsState';
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

      const stepsState = calcStepsState({
        repoContext,
        pullRequest: updatedPullRequest,
      });

      await Promise.all([
        editOpenedPR({
          pullRequest: updatedPullRequest,
          context,
          appContext,
          repoContext,
          reviewflowPrContext,
          shouldUpdateCommentBodyInfos: true,
        }),
        updateStatusCheckFromStepsState(
          stepsState,
          updatedPullRequest,
          context,
          appContext,
          reviewflowPrContext,
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
