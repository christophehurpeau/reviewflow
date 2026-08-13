import type {
  EventsWithRepository,
  RepoContext,
} from "../../../context/repoContext.ts";
import type { ProbotEvent } from "../../probot-types.ts";
import type { ReviewflowPrContext } from "../utils/createPullRequestContext.ts";
import type { Options } from "./utils/body/prOptions.ts";
import { updateCommentOptions } from "./utils/body/updateBody.ts";

const updatePrCommentBody = async <Name extends EventsWithRepository>(
  context: ProbotEvent<Name>,
  reviewflowPrContext: ReviewflowPrContext,
  newBody: string,
): Promise<void> => {
  await context.octokit.rest.issues.updateComment(
    context.repo({
      comment_id: reviewflowPrContext.reviewflowPr.commentId,
      body: newBody,
    }),
  );
  reviewflowPrContext.commentBody = newBody;
};

export const updatePrCommentBodyIfNeeded = async <
  Name extends EventsWithRepository,
>(
  context: ProbotEvent<Name>,
  reviewflowPrContext: ReviewflowPrContext,
  newBody: string,
): Promise<void> => {
  if (reviewflowPrContext.commentBody !== newBody) {
    await updatePrCommentBody(context, reviewflowPrContext, newBody);
  }
};

export const updatePrCommentBodyOptions = async <
  Name extends EventsWithRepository,
>(
  context: ProbotEvent<Name>,
  repoContext: RepoContext,
  reviewflowPrContext: ReviewflowPrContext,
  updateOptions: Partial<Options>,
): Promise<void> => {
  const { commentBody: newBody } = updateCommentOptions(
    repoContext.settings,
    context.payload.repository.html_url,
    repoContext.config.labels.list,
    reviewflowPrContext.commentBody,
    repoContext.config.prDefaultOptions,
    updateOptions,
  );

  await updatePrCommentBodyIfNeeded(context, reviewflowPrContext, newBody);
};
