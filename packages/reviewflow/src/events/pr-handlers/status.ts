import { Logger } from "nightingale-logger";
import type { Probot } from "probot";
import type { ReviewflowPr } from "reviewflow-core";
import type { AppContext } from "../../context/AppContext.ts";
import {
  getCommitStatusKey,
  isSameStoredRecord,
  toStoredCommitStatus,
} from "../../utils/github/pullRequest/checksAndStatuses.ts";
import {
  calcAndUpdateChecksAndStatuses,
  getChecksAndStatusesState,
} from "./actions/calcAndUpdateChecksAndStatuses.ts";
import { updateSlackHomeForPr } from "./actions/utils/updateSlackHome.ts";
import { createPullRequestsHandler } from "./utils/createPullRequestHandler.ts";
import { fetchPr } from "./utils/fetchPr.ts";

const logger = new Logger("reviewflow:status");

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
        logger.info("commit sha mismatch");
        // filter prs that have newer commit sha
        return;
      }

      if (context.payload.state !== "pending") {
        await repoContext.rescheduleOnChecksUpdated(context, pullRequest, {
          checkName: context.payload.context,
          hasFailed:
            context.payload.state === "failure" ||
            context.payload.state === "error",
          pullRequestLabels: pullRequest.labels,
        });
      }

      const statusesConclusion =
        reviewflowPrContext?.reviewflowPr.statusesConclusion;
      if (reviewflowPrContext && statusesConclusion) {
        const key = getCommitStatusKey(context.payload);
        const storedStatus = statusesConclusion[key];
        const receivedStatus = toStoredCommitStatus(context.payload);
        if (isSameStoredRecord(storedStatus, receivedStatus)) return;

        const storeStatus = (): Promise<unknown> =>
          appContext.mongoStores.prs.partialUpdateOne(
            reviewflowPrContext.reviewflowPr,
            {
              $set: { [`statusesConclusion.${key}`]: receivedStatus } as any,
            },
          );

        if (storedStatus?.state === receivedStatus.state) {
          statusesConclusion[key] = receivedStatus;
          await storeStatus();
          return;
        }

        const previousChecksState = getChecksAndStatusesState(
          reviewflowPrContext.reviewflowPr,
          repoContext,
        );

        statusesConclusion[key] = receivedStatus;

        // TODO calc and update ci step state
        await Promise.all([
          calcAndUpdateChecksAndStatuses(
            context,
            appContext,
            repoContext,
            pullRequest,
            reviewflowPrContext,
          ),
          storeStatus(),
        ]);

        // the home shows the checks, but only a transition is worth republishing
        if (
          getChecksAndStatusesState(
            reviewflowPrContext.reviewflowPr,
            repoContext,
          ) !== previousChecksState
        ) {
          updateSlackHomeForPr(repoContext, pullRequest, {
            owners: true,
          });
        }
      }
    },
  );
}
