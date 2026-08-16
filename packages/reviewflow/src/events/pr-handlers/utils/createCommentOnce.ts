import type { EventsWithRepository } from "../../../context/repoContext.ts";
import { checkIfIsThisBot } from "../../../utils/github/isBotUser.ts";
import type { ProbotEvent } from "../../probot-types.ts";

interface CreateCommentOnceOptions {
  pullRequestNumber: number;
  marker: string;
  body: string;
}

const findCommentWithMarker = async <EventName extends EventsWithRepository>(
  context: ProbotEvent<EventName>,
  pullRequestNumber: number,
  marker: string,
): Promise<boolean> => {
  let found = false;
  await context.octokit.paginate(
    context.octokit.rest.issues.listComments,
    context.repo({ issue_number: pullRequestNumber }),
    (response, done) => {
      found = response.data.some(
        (comment) =>
          comment.user &&
          checkIfIsThisBot(comment.user) &&
          comment.body?.includes(marker),
      );
      if (found) done();
      return [];
    },
  );
  return found;
};

export const createCommentOnce = async <EventName extends EventsWithRepository>(
  context: ProbotEvent<EventName>,
  { pullRequestNumber, marker, body }: CreateCommentOnceOptions,
): Promise<boolean> => {
  const alreadyCommented = await findCommentWithMarker(
    context,
    pullRequestNumber,
    marker,
  );
  if (alreadyCommented) return false;

  await context.octokit.rest.issues.createComment(
    context.repo({
      issue_number: pullRequestNumber,
      body: `${marker}\n${body}`,
    }),
  );
  return true;
};
