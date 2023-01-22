import type { Probot } from 'probot';
import type { AppContext } from '../../context/AppContext';
import { getChecksAndStatusesForPullRequest } from '../../utils/github/pullRequest/checksAndStatuses';
import { autoMergeIfPossible } from './actions/autoMergeIfPossible';
import { calcAndUpdateLabels } from './actions/calcAndUpdateLabels';
import { editOpenedPR } from './actions/editOpenedPR';
import { mergeOrEnableGithubAutoMerge } from './actions/enableGithubAutoMerge';
import { updateStatusCheckFromStepsState } from './actions/updateStatusCheckFromStepsState';
import hasLabelInPR from './actions/utils/labels/hasLabelInPR';
import { calcStepsState } from './actions/utils/steps/calcStepsState';
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

      const [updatedPr, checksAndStatuses] = await Promise.all([
        fetchPr(context, pullRequest.number),
        // on new sync, fetch checks as they changed since last commit / changed for new base head
        getChecksAndStatusesForPullRequest(context, pullRequest),
      ]);
      // old and new sha
      // const { before, after } = context.payload;
      const previousSha = (context.payload as any).before as string;

      // update reviewflowPrContext for calcAndUpdateLabels
      reviewflowPrContext.reviewflowPr.checksConclusion =
        checksAndStatuses.checksConclusionRecord;
      reviewflowPrContext.reviewflowPr.statusesConclusion =
        checksAndStatuses.statusesConclusionRecord;

      const updatedLabels = await calcAndUpdateLabels(
        context,
        appContext,
        repoContext,
        pullRequest,
        reviewflowPrContext,
        false,
      );

      const stepsState = calcStepsState({
        repoContext,
        pullRequest: updatedPr,
        labels: updatedLabels,
      });

      // headSha is updated there too
      await Promise.all([
        editOpenedPR({
          pullRequest: updatedPr,
          context,
          appContext,
          repoContext,
          reviewflowPrContext,
          stepsState,
          shouldUpdateCommentBodyInfos: true,
          shouldUpdateCommentBodyProgress: true, // CI
          previousSha,
          checksAndStatuses,
        }),
        // update status check if new commit is pushed
        previousSha &&
          updateStatusCheckFromStepsState(
            stepsState,
            pullRequest,
            context,
            repoContext,
            appContext,
            reviewflowPrContext,
            previousSha,
          ),
      ]);

      if (
        repoContext.settings.allowAutoMerge &&
        repoContext.config.experimentalFeatures?.githubAutoMerge
      ) {
        const autoMergeLabel = repoContext.labels['merge/automerge'];

        if (hasLabelInPR(pullRequest.labels, autoMergeLabel)) {
          await mergeOrEnableGithubAutoMerge(
            pullRequest,
            context,
            repoContext,
            reviewflowPrContext,
          );
        }
      } else {
        // call autoMergeIfPossible to re-add to the queue when push is fixed
        await autoMergeIfPossible(
          updatedPr,
          context,
          repoContext,
          reviewflowPrContext,
        );
      }
    },
  );
}
