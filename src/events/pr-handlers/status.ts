import type { Probot } from "probot";
import type { ReviewflowPr } from "src/mongo.ts";
import type { AppContext } from "../../context/AppContext";
import { calcAndUpdateChecksAndStatuses } from "./actions/calcAndUpdateChecksAndStatuses";
import { createPullRequestsHandler } from "./utils/createPullRequestHandler";
import { fetchPr } from "./utils/fetchPr";

export default function status(app: Probot, appContext: AppContext): void {
  createPullRequestsHandler(
    app,
    appContext,
    "status",
    async (payload, repoContext): Promise<ReviewflowPr["pr"][]> => {
      if (repoContext.shouldIgnore) return [];
      if (payload.context === process.env.REVIEWFLOW_NAME) return [];

      const prsForShaCursor = await appContext.mongoStores.prs.findAll({
        "account.id": repoContext.accountEmbed.id,
        "repo.id": repoContext.repoEmbed.id,
        headSha: payload.commit.sha,
      });

      return prsForShaCursor.map((reviewflowPr) => reviewflowPr.pr);
    },
    async (
      prEmbed,
      context,
      repoContext,
      reviewflowPrContext,
    ): Promise<void> => {
      // after lock, we need to fetch pr again to get the latest data. If pr was synchronized, and new commit is pushed, we need to ignore this status update.
      const pullRequest = await fetchPr(context, prEmbed.number);

      if (context.payload.commit.sha !== pullRequest.head.sha) {
        console.log("commit sha mismatch");
        // filter prs that have newer commit sha
        return;
      }

      if (context.payload.state !== "pending") {
        await repoContext.rescheduleOnChecksUpdated(
          context,
          pullRequest,
          context.payload.state === "success",
        );
      }

      if (reviewflowPrContext?.reviewflowPr.statusesConclusion) {
        const key = context.payload.context.replace(/[\s.]/g, "_");

        if (
          reviewflowPrContext.reviewflowPr.statusesConclusion[key]?.state ===
          context.payload.state
        ) {
          return;
        }

        reviewflowPrContext.reviewflowPr.statusesConclusion[key] = {
          state: context.payload.state,
          context: context.payload.context,
        };

        // TODO calc and update ci step state
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
                [`statusesConclusion.${key}`]: {
                  context: context.payload.context,
                  state: context.payload.state,
                },
              } as any,
            },
          ),
        ]);
      }
    },
  );
}
