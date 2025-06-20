import type { Probot } from "probot";
import type { AppContext } from "../../context/AppContext.ts";
import { getChecksAndStatusesForPullRequest } from "../../utils/github/pullRequest/checksAndStatuses.ts";
import { calcAndUpdateChecksAndStatuses } from "./actions/calcAndUpdateChecksAndStatuses.ts";
import { editOpenedPR } from "./actions/editOpenedPR.ts";
import { tryToAutomerge } from "./actions/tryToAutomerge.ts";
import { updateStatusCheckFromStepsState } from "./actions/updateStatusCheckFromStepsState.ts";
import { calcStepsState } from "./actions/utils/steps/calcStepsState.ts";
import { createPullRequestHandler } from "./utils/createPullRequestHandler.ts";
import { fetchPr } from "./utils/fetchPr.ts";

export default function synchronize(app: Probot, appContext: AppContext): void {
  createPullRequestHandler(
    app,
    appContext,
    "pull_request.synchronize",

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

      // update reviewflowPrContext for calcAndUpdateChecksAndStatuses
      reviewflowPrContext.reviewflowPr.checksConclusion =
        checksAndStatuses.checksConclusionRecord;
      reviewflowPrContext.reviewflowPr.statusesConclusion =
        checksAndStatuses.statusesConclusionRecord;

      const updatedLabels = await calcAndUpdateChecksAndStatuses(
        context,
        appContext,
        repoContext,
        updatedPr,
        reviewflowPrContext,
        false,
        previousSha,
      );

      const stepsState = calcStepsState({
        repoContext,
        pullRequest: updatedPr,
        reviewflowPrContext,
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
            updatedLabels,
            previousSha,
          ),
      ]);

      await tryToAutomerge({
        pullRequest: updatedPr,
        context,
        repoContext,
        reviewflowPrContext,
      });
    },
  );
}
