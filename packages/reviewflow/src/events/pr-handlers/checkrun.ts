import { Logger } from "nightingale-logger";
import type { Probot } from "probot";
import type { AppContext } from "../../context/AppContext.ts";
import {
  getCheckRunKey,
  isSameStoredRecord,
  toStoredCheckRun,
} from "../../utils/github/pullRequest/checksAndStatuses.ts";
import {
  calcAndUpdateChecksAndStatuses,
  getChecksAndStatusesState,
} from "./actions/calcAndUpdateChecksAndStatuses.ts";
import { updateSlackHomeForPr } from "./actions/utils/updateSlackHome.ts";
import { createPullRequestsHandler } from "./utils/createPullRequestHandler.ts";
import { fetchPr } from "./utils/fetchPr.ts";

const logger = new Logger("reviewflow:checkrun");

export default function checkrun(app: Probot, appContext: AppContext): void {
  createPullRequestsHandler(
    app,
    appContext,
    ["check_run.created", "check_run.completed"],
    async (payload, repoContext) => {
      if (repoContext.shouldIgnore) return [];

      const prsForShaCursor = await appContext.mongoStores.prs.findAll({
        "account.id": repoContext.accountEmbed.id,
        "repo.id": repoContext.repoEmbed.id,
        headSha: payload.check_run.head_sha,
      });

      const prs = prsForShaCursor.map((reviewflowPr) => reviewflowPr.pr);

      for (const pr of payload.check_run.pull_requests) {
        if (!prs.some((reviewflowPr) => reviewflowPr.number === pr.number)) {
          prs.push(pr);
        }
      }

      return prs;
    },
    async (pullRequestCheckRun, context, repoContext, reviewflowPrContext) => {
      const { action, check_run: checkRun } = context.payload;

      // after lock, we need to fetch pr again to get the latest data. If pr was synchronized, and new commit is pushed, we need to ignore this status update.
      const pullRequest = await fetchPr(context, pullRequestCheckRun.number);

      if (
        action === "completed" &&
        checkRun.head_sha === pullRequest.head.sha
      ) {
        await repoContext.rescheduleOnChecksUpdated(context, pullRequest, {
          checkName: checkRun.name,
          hasFailed:
            checkRun.conclusion === "failure" ||
            checkRun.conclusion === "cancelled" ||
            checkRun.conclusion === "timed_out",
          pullRequestLabels: pullRequest.labels,
        });
      }

      if (reviewflowPrContext?.reviewflowPr.headSha !== checkRun.head_sha) {
        logger.info("head sha mismatch");
        return;
      }

      const { checksConclusion } = reviewflowPrContext.reviewflowPr;
      if (checksConclusion) {
        const key = getCheckRunKey(checkRun);
        const storedCheckRun = checksConclusion[key];
        const receivedCheckRun = toStoredCheckRun(checkRun);
        if (isSameStoredRecord(storedCheckRun, receivedCheckRun)) return;

        const storeCheckRun = (): Promise<unknown> =>
          appContext.mongoStores.prs.partialUpdateOne(
            reviewflowPrContext.reviewflowPr,
            {
              $set: { [`checksConclusion.${key}`]: receivedCheckRun } as any,
            },
          );

        if (storedCheckRun?.conclusion === receivedCheckRun.conclusion) {
          checksConclusion[key] = receivedCheckRun;
          await storeCheckRun();
          return;
        }

        const previousChecksState = getChecksAndStatusesState(
          reviewflowPrContext.reviewflowPr,
          repoContext,
        );

        checksConclusion[key] = receivedCheckRun;

        await Promise.all([
          calcAndUpdateChecksAndStatuses(
            context,
            appContext,
            repoContext,
            pullRequest,
            reviewflowPrContext,
          ),
          storeCheckRun(),
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
