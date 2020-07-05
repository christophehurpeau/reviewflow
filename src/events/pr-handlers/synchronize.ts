import { Application } from 'probot';
import { AppContext } from '../../context/AppContext';
import { createPullRequestHandler } from './utils/createPullRequestHandler';
import { editOpenedPR } from './actions/editOpenedPR';
import { updateStatusCheckFromLabels } from './actions/updateStatusCheckFromLabels';
import { autoMergeIfPossible } from './actions/autoMergeIfPossible';
import { fetchPullRequestAndCreateContext } from './utils/createPullRequestContext';

export default function synchronize(
  app: Application,
  appContext: AppContext,
): void {
  app.on(
    'pull_request.synchronize',
    createPullRequestHandler(
      appContext,
      (payload) => payload.pull_request,
      async (prContext, context): Promise<void> => {
        const updatedPrContext = await fetchPullRequestAndCreateContext(
          context,
          prContext,
        );
        // old and new sha
        // const { before, after } = context.payload;
        const previousSha = (context.payload as any).before as string;

        await Promise.all([
          editOpenedPR(updatedPrContext, context, true, previousSha),
          // addStatusCheckToLatestCommit
          updateStatusCheckFromLabels(
            updatedPrContext,
            updatedPrContext.updatedPr,
            context,
            updatedPrContext.updatedPr.labels,
            previousSha,
          ),
        ]);

        // call autoMergeIfPossible to re-add to the queue when push is fixed
        await autoMergeIfPossible(updatedPrContext, context);
      },
    ),
  );
}
