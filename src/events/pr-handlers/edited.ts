import type { Probot } from "probot";
import type { AppContext } from "../../context/AppContext.ts";
import { checkIfIsThisBot } from "../../utils/github/isBotUser.ts";
import { getChecksAndStatusesForPullRequest } from "../../utils/github/pullRequest/checksAndStatuses.ts";
import { editOpenedPR } from "./actions/editOpenedPR.ts";
import { tryToAutomerge } from "./actions/tryToAutomerge.ts";
import { updateStatusCheckFromStepsState } from "./actions/updateStatusCheckFromStepsState.ts";
import { calcStepsState } from "./actions/utils/steps/calcStepsState.ts";
import { createPullRequestHandler } from "./utils/createPullRequestHandler.ts";
import { fetchPr } from "./utils/fetchPr.ts";

export default function edited(app: Probot, appContext: AppContext): void {
  createPullRequestHandler(
    app,
    appContext,
    "pull_request.edited",
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

      const [updatedPullRequest, checksAndStatuses] = await Promise.all([
        fetchPr(context, context.payload.pull_request.number),
        context.payload.changes.base ||
        !reviewflowPrContext.reviewflowPr.checksConclusion
          ? getChecksAndStatusesForPullRequest(context, pullRequest)
          : undefined,
      ]);

      if (checksAndStatuses) {
        reviewflowPrContext.reviewflowPr.checksConclusion =
          checksAndStatuses.checksConclusionRecord;
        reviewflowPrContext.reviewflowPr.statusesConclusion =
          checksAndStatuses.statusesConclusionRecord;
      }

      const stepsState = calcStepsState({
        repoContext,
        pullRequest: updatedPullRequest,
        reviewflowPrContext,
      });

      await Promise.all([
        editOpenedPR({
          pullRequest: updatedPullRequest,
          context,
          appContext,
          repoContext,
          reviewflowPrContext,
          stepsState,
          shouldUpdateCommentBodyInfos: true,
          shouldUpdateCommentBodyProgress: true,
          shouldUpdateSlackHomeOnTitleChange: true,
          checksAndStatuses,
        }),
        updateStatusCheckFromStepsState(
          stepsState,
          updatedPullRequest,
          context,
          repoContext,
          appContext,
          reviewflowPrContext,
        ),
      ]);

      await tryToAutomerge({
        pullRequest: updatedPullRequest,
        context,
        repoContext,
        reviewflowPrContext,
      });
    },
  );
}
