import { ExpectedError } from "../../../ExpectedError";
import type { ProbotEvent } from "../../probot-types";
import type {
  EventsWithIssue,
  EventsWithPullRequest,
} from "./createPullRequestHandler";

export type PullRequestFromEventWithIssue = NonNullable<
  ProbotEvent<EventsWithIssue>["payload"]["issue"]["pull_request"]
> &
  ProbotEvent<EventsWithIssue>["payload"]["issue"];

export type PullRequestFromProbotEvent<
  EventName extends EventsWithIssue | EventsWithPullRequest,
> = ProbotEvent<EventName>["payload"] extends {
  pull_request: ProbotEvent<EventsWithPullRequest>["payload"]["pull_request"];
}
  ? ProbotEvent<EventsWithPullRequest>["payload"]["pull_request"]
  : ProbotEvent<EventName>["payload"] extends {
        issue: ProbotEvent<EventsWithIssue>["payload"]["issue"];
      }
    ? PullRequestFromEventWithIssue
    :
        | ProbotEvent<EventsWithPullRequest>["payload"]["pull_request"]
        | PullRequestFromEventWithIssue;

/** deprecated */
export const getPullRequestFromPayload = <
  EventName extends EventsWithIssue | EventsWithPullRequest,
>(
  payload: ProbotEvent<EventName>["payload"],
): PullRequestFromProbotEvent<EventName> => {
  const pullRequest =
    "pull_request" in payload ? payload.pull_request : undefined;

  if (pullRequest) {
    return pullRequest as PullRequestFromProbotEvent<EventName>;
  }

  const issue = "issue" in payload ? payload.issue : undefined;

  if (!issue) {
    throw new ExpectedError("No pull_request or issue found");
  }

  if (issue.pull_request) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return {
      ...issue,
      ...issue.pull_request,
    } as PullRequestFromProbotEvent<EventName>;
  }

  throw new ExpectedError("No pull_request in payload");
};
