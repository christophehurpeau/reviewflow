import type { Probot } from 'probot';
import type { AppContext } from 'context/AppContext';
import { checkIfUserIsBot } from '../../utils/github/isBotUser';
import { getChecksAndStatusesForPullRequest } from '../../utils/github/pullRequest/checksAndStatuses';
import { autoAssignPRToCreator } from './actions/autoAssignPRToCreator';
import { editOpenedPR } from './actions/editOpenedPR';
import { updateReviewStatus } from './actions/updateReviewStatus';
import { updateStatusCheckFromStepsState } from './actions/updateStatusCheckFromStepsState';
import { defaultCommentBody } from './actions/utils/body/updateBody';
import { calcStepsState } from './actions/utils/steps/calcStepsState';
import { syncLabels } from './actions/utils/syncLabel';
import { createPullRequestHandler } from './utils/createPullRequestHandler';
import { createReviewflowComment } from './utils/reviewflowComment';

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

        Promise.all([
          getChecksAndStatusesForPullRequest(context, pullRequest), // get required (pending) statuses or checks
          updateReviewStatus(pullRequest, context, repoContext, [
            {
              reviewGroup: 'dev',
              add:
                (repoContext.config.requiresReviewRequest || isFromBot) &&
                !pullRequest.draft
                  ? ['needsReview']
                  : [],
              remove: ['approved', 'changesRequested'],
            },
          ]),
        ]).then(async ([checksAndStatuses, newLabels]) => {
          // TODO calc steps state AFTER updating checksAndStatuses
          const stepsState = calcStepsState({
            repoContext,
            pullRequest,
            labels: newLabels,
          });

          await Promise.all([
            updateStatusCheckFromStepsState(
              stepsState,
              pullRequest,
              context,
              appContext,
              reviewflowPrContext,
            ),
            editOpenedPR({
              pullRequest,
              context,
              appContext,
              repoContext,
              reviewflowPrContext,
              stepsState,
              shouldUpdateCommentBodyInfos: true,
              shouldUpdateCommentBodyProgress: true,
              checksAndStatuses,
            }),
          ]);
        }),
      ]);
    },
    (pullRequest, context) => ({
      reviewflowCommentPromise: createReviewflowComment(
        pullRequest.number,
        context,
        defaultCommentBody,
      ),
    }),
  );
}
