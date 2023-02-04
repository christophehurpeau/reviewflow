import type { Probot } from 'probot';
import type { AppContext } from 'context/AppContext';
import { checkIfUserIsBot } from '../../utils/github/isBotUser';
import { getChecksAndStatusesForPullRequest } from '../../utils/github/pullRequest/checksAndStatuses';
import { autoAssignPRToCreator } from './actions/autoAssignPRToCreator';
import { editOpenedPR } from './actions/editOpenedPR';
import { mergeOrEnableGithubAutoMerge } from './actions/enableGithubAutoMerge';
import { updateReviewStatus } from './actions/updateReviewStatus';
import { updateStatusCheckFromStepsState } from './actions/updateStatusCheckFromStepsState';
// import { defaultCommentBody } from './actions/utils/body/updateBody';
import { calcStepsState } from './actions/utils/steps/calcStepsState';
import { syncLabels } from './actions/utils/syncLabel';
import type { PullRequestLabels } from './utils/PullRequestData';
import { createPullRequestHandler } from './utils/createPullRequestHandler';
// import { createReviewflowComment } from './utils/reviewflowComment';

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
      let pullRequestLabels: PullRequestLabels = pullRequest.labels;

      if (isFromBot) {
        // sync labels before `editOpenedPR` to make sure comment has automerge selected
        pullRequestLabels = await syncLabels(pullRequest, context, [
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
                (repoContext.config.requiresReviewRequest ||
                  isFromBot ||
                  pullRequest.user.id !==
                    context.payload.repository.owner.id) &&
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
            isFromBot &&
              mergeOrEnableGithubAutoMerge(
                pullRequest,
                context,
                repoContext,
                reviewflowPrContext,
                context.payload.sender.login,
                true,
              ),
            updateStatusCheckFromStepsState(
              stepsState,
              pullRequest,
              context,
              repoContext,
              appContext,
              reviewflowPrContext,
            ),
            editOpenedPR({
              pullRequest,
              pullRequestLabels,
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
    // https://sentry.io/organizations/chrp/issues/3888881569/?project=1243466&query=is%3Aunresolved&referrer=issue-stream
    // https://github.com/christophehurpeau/reviewflow/pull/617
    // (pullRequest, context) => ({
    //   reviewflowCommentPromise: createReviewflowComment(
    //     pullRequest.number,
    //     context,
    //     defaultCommentBody,
    //   ),
    // }),
  );
}
