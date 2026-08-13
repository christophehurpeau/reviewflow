import type {
  EventsWithRepository,
  RepoContext,
} from "../../../context/repoContext.ts";
import { getChecksAndStatusesForPullRequest } from "../../../utils/github/pullRequest/checksAndStatuses.ts";
import type { ProbotEvent } from "../../probot-types.ts";
import type { PullRequestWithDecentData } from "./PullRequestData.ts";
import type { ReviewflowPrContext } from "./createPullRequestContext.ts";
import { getFailedOrWaitingChecksAndStatuses } from "./getFailedOrWaitingChecksAndStatuses.ts";

interface GetFailedChecksAndStatusesForMergeOptions<
  EventName extends EventsWithRepository,
  TeamNames extends string,
> {
  pullRequest: PullRequestWithDecentData;
  context: ProbotEvent<EventName>;
  repoContext: RepoContext<TeamNames>;
  reviewflowPrContext: ReviewflowPrContext;
}

/*
 * Names of the checks and statuses that failed on the head commit and are not allowed to fail.
 * A merge is irreversible: the conclusions stored on the reviewflow pr document are only usable
 * when they describe the commit that is about to be merged, otherwise they are re-fetched.
 */
export const getFailedChecksAndStatusesForMerge = async <
  EventName extends EventsWithRepository,
  TeamNames extends string,
>({
  pullRequest,
  context,
  repoContext,
  reviewflowPrContext,
}: GetFailedChecksAndStatusesForMergeOptions<EventName, TeamNames>): Promise<
  string[]
> => {
  const { checksConclusion, statusesConclusion, headSha } =
    reviewflowPrContext.reviewflowPr;

  const checksAndStatuses =
    checksConclusion && statusesConclusion && headSha === pullRequest.head.sha
      ? {
          checksConclusionRecord: checksConclusion,
          statusesConclusionRecord: statusesConclusion,
        }
      : await getChecksAndStatusesForPullRequest(context, pullRequest);

  const { failedChecks, failedStatuses } = getFailedOrWaitingChecksAndStatuses(
    checksAndStatuses,
    repoContext,
  );

  return [...failedChecks, ...failedStatuses];
};
