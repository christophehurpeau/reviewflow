import type { Probot } from "probot";
import type { AppContext } from "../../context/AppContext.ts";
import { createPullRequestsHandler } from "./utils/createPullRequestHandler.ts";

export default function checksuiteCompleted(
  app: Probot,
  appContext: AppContext,
): void {
  createPullRequestsHandler(
    app,
    appContext,
    "check_suite.completed",
    (payload, repoContext) => {
      if (repoContext.shouldIgnore) return [];
      return payload.check_suite.pull_requests;
    },
    async (pullRequest, context, repoContext) => {
      const { check_suite: checkSuite } = context.payload;

      await repoContext.rescheduleOnChecksUpdated(context, pullRequest, {
        checkName: checkSuite.app.name,
        hasFailed:
          checkSuite.conclusion === "failure" ||
          checkSuite.conclusion === "cancelled" ||
          checkSuite.conclusion === "timed_out",
      });
    },
  );
}
