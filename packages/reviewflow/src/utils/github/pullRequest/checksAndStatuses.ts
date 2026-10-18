import type { EmitterWebhookEventName } from "@octokit/webhooks";
import type {
  ChecksAndStatuses,
  StoredCheckRun,
  StoredCommitStatus,
} from "reviewflow-core";
import type { PullRequestData } from "../../../events/pr-handlers/utils/PullRequestData";
import type { ProbotEvent } from "../../../events/probot-types";

interface CheckRunLike {
  name: string;
  status: string;
  conclusion: string | null;
  details_url: string | null;
  output: { title: string | null };
  check_suite: { id?: number } | null;
}

interface CommitStatusLike {
  context: string;
  state: string;
  description: string | null;
  target_url: string | null;
}

/** the check suite stays the same on "re-run failed jobs", the check run id changes */
export const getCheckRunKey = (checkRun: CheckRunLike): string =>
  `${checkRun.check_suite?.id}_${checkRun.name}`.replace(/[\s.]/g, "_");

export const getCommitStatusKey = (status: CommitStatusLike): string =>
  status.context.replace(/[\s.]/g, "_");

export const toStoredCheckRun = (checkRun: CheckRunLike): StoredCheckRun => ({
  name: checkRun.name,
  status: checkRun.status as StoredCheckRun["status"],
  conclusion: checkRun.conclusion as StoredCheckRun["conclusion"],
  title: checkRun.output.title,
  details_url: checkRun.details_url,
});

export const toStoredCommitStatus = (
  status: CommitStatusLike,
): StoredCommitStatus => ({
  context: status.context,
  state: status.state,
  description: status.description,
  target_url: status.target_url,
});

export const isSameStoredRecord = <T extends object>(
  stored: T | undefined,
  received: T,
): boolean =>
  stored !== undefined &&
  (Object.keys(received) as (keyof T)[]).every(
    (key) => stored[key] === received[key],
  );

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
        getCheckRunKey(checkRun),
        toStoredCheckRun(checkRun),
      ]),
  );
  const statusesConclusionRecord = Object.fromEntries(
    combinedStatus.data.statuses
      .filter((status) => status.context !== process.env.REVIEWFLOW_NAME)
      .map((status) => [
        getCommitStatusKey(status),
        toStoredCommitStatus(status),
      ]),
  );

  return { checksConclusionRecord, statusesConclusionRecord };
};
