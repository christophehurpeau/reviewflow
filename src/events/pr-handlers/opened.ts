import type { Probot } from 'probot';
import type { AppContext } from 'context/AppContext';
import { autoApproveAndAutoMerge } from './actions/autoApproveAndAutoMerge';
import { autoAssignPRToCreator } from './actions/autoAssignPRToCreator';
import { editOpenedPR } from './actions/editOpenedPR';
import { updateReviewStatus } from './actions/updateReviewStatus';
import { syncLabels } from './actions/utils/syncLabel';
import { createPullRequestHandler } from './utils/createPullRequestHandler';
import { fetchPr } from './utils/fetchPr';
import { checkIfUserIsBot } from './utils/isBotUser';

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

      await Promise.all<unknown>([
        !isFromBot && autoAssignPRToCreator(pullRequest, context, repoContext),
        isFromBot &&
          repoContext.config.requiresReviewRequest &&
          syncLabels(pullRequest, context, [
            {
              shouldHaveLabel: true,
              label: autoMergeLabel,
            },
          ]),
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
