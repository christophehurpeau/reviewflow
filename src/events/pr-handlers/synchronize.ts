import type { Probot } from 'probot';
import type { AppContext } from '../../context/AppContext';
import { autoMergeIfPossible } from './actions/autoMergeIfPossible';
import { editOpenedPR } from './actions/editOpenedPR';
import { updateStatusCheckFromLabels } from './actions/updateStatusCheckFromLabels';
import { createPullRequestHandler } from './utils/createPullRequestHandler';
import { fetchPr } from './utils/fetchPr';

export default function synchronize(app: Probot, appContext: AppContext): void {
  createPullRequestHandler(
    app,
    appContext,
    'pull_request.synchronize',

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
      if (!reviewflowPrContext) return;

      const updatedPr = await fetchPr(context, pullRequest.number);
      // old and new sha
      // const { before, after } = context.payload;
      const previousSha = (context.payload as any).before as string;

      await Promise.all([
        editOpenedPR(
          updatedPr,
          context,
          appContext,
          repoContext,
          reviewflowPrContext,
          true,
          previousSha,
        ),
        // addStatusCheckToLatestCommit
        updateStatusCheckFromLabels(
          updatedPr,
          context,
          appContext,
          repoContext,
          reviewflowPrContext,
          updatedPr.labels,
          previousSha,
        ),
      ]);

      // call autoMergeIfPossible to re-add to the queue when push is fixed
      await autoMergeIfPossible(
        updatedPr,
        context,
        repoContext,
        reviewflowPrContext,
      );
    },
  );
}
