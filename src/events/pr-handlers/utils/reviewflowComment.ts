import type { RestEndpointMethodTypes } from "@octokit/rest";
import type { EventsWithRepository } from "../../../context/repoContext";
import { checkIfIsThisBot } from "../../../utils/github/isBotUser";
import type { ProbotEvent } from "../../probot-types";
import { defaultCommentBody } from "../actions/utils/body/updateBody";
import type { PullRequestWithDecentDataFromWebhook } from "./PullRequestData";

export const createReviewflowComment = <EventName extends EventsWithRepository>(
  pullRequestNumber: PullRequestWithDecentDataFromWebhook["number"],
  context: ProbotEvent<EventName>,
  body: string,
): Promise<
  RestEndpointMethodTypes["issues"]["createComment"]["response"]["data"]
> => {
  return context.octokit.issues
    .createComment(context.repo({ issue_number: pullRequestNumber, body }))
    .then(({ data }) => data);
};

export const getReviewflowCommentById = <
  EventName extends EventsWithRepository,
>(
  pullRequestNumber: PullRequestWithDecentDataFromWebhook["number"],
  context: ProbotEvent<EventName>,
  commentId: number,
): Promise<
  RestEndpointMethodTypes["issues"]["getComment"]["response"]["data"] | null
> => {
  return context.octokit.issues
    .getComment(
      context.repo({
        issue_number: pullRequestNumber,
        comment_id: commentId,
      }),
    )
    .then(
      ({ data }) => data,
      () => null,
    );
};

export const findReviewflowComment = async <
  EventName extends EventsWithRepository,
>(
  pullRequestNumber: PullRequestWithDecentDataFromWebhook["number"],
  context: ProbotEvent<EventName>,
): Promise<
  | RestEndpointMethodTypes["issues"]["listComments"]["response"]["data"][number]
  | null
> => {
  let found:
    | RestEndpointMethodTypes["issues"]["listComments"]["response"]["data"][number]
    | null = null;
  await context.octokit.paginate(
    context.octokit.issues.listComments,
    context.repo({
      issue_number: pullRequestNumber,
    }),
    (response, done) => {
      found =
        response.data.find(
          (comment) =>
            comment.user &&
            checkIfIsThisBot(comment.user) &&
            (comment.body === defaultCommentBody ||
              comment.body?.includes("<!-- reviewflow-")),
        ) || null;
      if (found) done();
      return [];
    },
  );
  return found;
};
