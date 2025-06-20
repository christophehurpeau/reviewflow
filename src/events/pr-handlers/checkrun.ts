import type { Probot } from "probot";
import type { AppContext } from "../../context/AppContext";
import { calcAndUpdateChecksAndStatuses } from "./actions/calcAndUpdateChecksAndStatuses";
import { createPullRequestsHandler } from "./utils/createPullRequestHandler";
import { fetchPr } from "./utils/fetchPr";

export default function checkrun(app: Probot, appContext: AppContext): void {
  createPullRequestsHandler(
    app,
    appContext,
    ["check_run.created", "check_run.completed"],
    (payload, repoContext) => {
      if (repoContext.shouldIgnore) return [];
      return payload.check_run.pull_requests;
    },
    async (pullRequestCheckRun, context, repoContext, reviewflowPrContext) => {
      const { action, check_run: checkRun } = context.payload;

      // after lock, we need to fetch pr again to get the latest data. If pr was synchronized, and new commit is pushed, we need to ignore this status update.
      const pullRequest = await fetchPr(context, pullRequestCheckRun.number);

      if (action === "completed") {
        await repoContext.rescheduleOnChecksUpdated(
          context,
          pullRequest,
          checkRun.conclusion === "success",
        );
      }

      if (reviewflowPrContext?.reviewflowPr.headSha !== checkRun.head_sha) {
        console.log("head sha mismatch");
        return;
      }

      if (reviewflowPrContext.reviewflowPr.checksConclusion) {
        const checkConclusionKey =
          `${checkRun.check_suite.id}_${checkRun.name}`.replace(/[\s.]/g, "_");
        if (
          reviewflowPrContext.reviewflowPr.checksConclusion[checkConclusionKey]
            ?.conclusion === checkRun.conclusion
        ) {
          return;
        }

        reviewflowPrContext.reviewflowPr.checksConclusion[checkConclusionKey] =
          { name: checkRun.name, conclusion: checkRun.conclusion as any };

        await Promise.all([
          calcAndUpdateChecksAndStatuses(
            context,
            appContext,
            repoContext,
            pullRequest,
            reviewflowPrContext,
          ),
          appContext.mongoStores.prs.partialUpdateOne(
            reviewflowPrContext.reviewflowPr,
            {
              $set: {
                [`checksConclusion.${checkConclusionKey}`]:
                  reviewflowPrContext.reviewflowPr.checksConclusion[
                    checkConclusionKey
                  ],
              } as any,
            },
          ),
        ]);
      }
    },
  );
}
