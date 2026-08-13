import type { RestEndpointMethodTypes } from "@octokit/rest";
import type { EmitterWebhookEventName } from "@octokit/webhooks";
import type { PullRequestData } from "../../../events/pr-handlers/utils/PullRequestData";
import type { ProbotEvent } from "../../../events/probot-types";

export interface ChecksAndStatuses {
  checksConclusionRecord: Record<
    string,
    Pick<
      RestEndpointMethodTypes["checks"]["listForRef"]["response"]["data"]["check_runs"][number],
      "conclusion" | "name"
    >
  >;
  statusesConclusionRecord: Record<
    string,
    Pick<
      RestEndpointMethodTypes["repos"]["getCombinedStatusForRef"]["response"]["data"]["statuses"][number],
      "context" | "state"
    >
  >;
}

export const getChecksAndStatusesForPullRequest = async <
  Name extends EmitterWebhookEventName,
>(
  context: ProbotEvent<Name>,
  pr: PullRequestData,
): Promise<ChecksAndStatuses> => {
  const [checks, combinedStatus] = await Promise.all([
    context.octokit.rest.checks.listForRef(
      context.repo({
        ref: pr.head.sha,
        per_page: 100,
      }),
    ),
    context.octokit.rest.repos.getCombinedStatusForRef(
      context.repo({
        ref: pr.head.sha,
        per_page: 100,
      }),
    ),
  ]);

  const checksConclusionRecord = Object.fromEntries(
    checks.data.check_runs
      .filter((checkRun) => checkRun.name !== process.env.REVIEWFLOW_NAME)
      .map((checkRun) => [
        // check_suite stays the same on rerun failed, but check id changes.
        `${checkRun.check_suite?.id}_${checkRun.name}`.replace(/[\s.]/g, "_"),
        { name: checkRun.name, conclusion: checkRun.conclusion },
      ]),
  );
  const statusesConclusionRecord = Object.fromEntries(
    combinedStatus.data.statuses
      .filter((status) => status.context !== process.env.REVIEWFLOW_NAME)
      .map((status) => [
        status.context.replace(/[\s.]/g, "_"),
        { context: status.context, state: status.state },
      ]),
  );

  return { checksConclusionRecord, statusesConclusionRecord };
};
