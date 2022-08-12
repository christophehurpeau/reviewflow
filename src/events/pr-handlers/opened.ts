import type { Probot } from 'probot';
import type { AppContext } from 'context/AppContext';
import { checkIfUserIsBot } from '../../utils/github/isBotUser';
import { autoApproveAndAutoMerge } from './actions/autoApproveAndAutoMerge';
import { autoAssignPRToCreator } from './actions/autoAssignPRToCreator';
import { editOpenedPR } from './actions/editOpenedPR';
import { updateReviewStatus } from './actions/updateReviewStatus';
import { syncLabels } from './actions/utils/syncLabel';
import { createPullRequestHandler } from './utils/createPullRequestHandler';
import { fetchPr } from './utils/fetchPr';

export default function opened(app: Probot, appContext: AppContext): void {
  createPullRequestHandler(
    app,
    appContext,
    'pull_request.opened',
    (payload, context, repoContext) => {
      if (repoContext.shouldIgnore) return null;
      return payload.pull_request;
    },
    async (pullRequest, context, repoContext, reviewflowPrContext) => {
      if (reviewflowPrContext === null) return;
      const isFromBot = !pullRequest.user
        ? false
        : checkIfUserIsBot(repoContext, pullRequest.user);
      const fromRenovate = pullRequest.head.ref.startsWith('renovate/');
      const autoMergeLabel = repoContext.labels['merge/automerge'];

      if (isFromBot && repoContext.config.requiresReviewRequest) {
        // sync labels before `editOpenedPR` to make sure comment has automerge selected
        await syncLabels(pullRequest, context, [
          {
            shouldHaveLabel: true,
            label: autoMergeLabel,
          },
        ]);
      }

      await Promise.all<unknown>([
        !isFromBot && autoAssignPRToCreator(pullRequest, context, repoContext),

        editOpenedPR({
          pullRequest,
          context,
          appContext,
          repoContext,
          reviewflowPrContext,
          shouldUpdateCommentBodyInfos: true,
        }),
        fromRenovate
          ? fetchPr(context, pullRequest.number).then((updatedPr) =>
              autoApproveAndAutoMerge(
                updatedPr,
                context,
                repoContext,
                reviewflowPrContext,
              ).then(async (approved: boolean): Promise<void> => {
                if (!approved) {
                  await updateReviewStatus(
                    pullRequest,
                    context,
                    appContext,
                    repoContext,
                    reviewflowPrContext,
                    'dev',
                    {
                      add: ['needsReview'],
                    },
                  );
                }
              }),
            )
          : updateReviewStatus(
              pullRequest,
              context,
              appContext,
              repoContext,
              reviewflowPrContext,
              'dev',
              {
                add:
                  repoContext.config.requiresReviewRequest && !pullRequest.draft
                    ? ['needsReview']
                    : [],
                remove: ['approved', 'changesRequested'],
              },
            ),
      ]);
    },
  );
}
