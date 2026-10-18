import type { Options } from "reviewflow-core";
import { recordPrActivity, toPrActivityTarget } from "reviewflow-core";
import type { AppContext } from "../../../context/AppContext.ts";
import type {
  EventsWithRepository,
  RepoContext,
} from "../../../context/repoContext.ts";
import type { ProbotEvent } from "../../probot-types.ts";
import type { ReviewflowPrContext } from "../utils/createPullRequestContext.ts";
import { updateCommentOptions } from "./utils/body/updateBody.ts";

interface UpdatePrCommentBodyOptions<Name extends EventsWithRepository> {
  appContext: AppContext;
  context: ProbotEvent<Name>;
  reviewflowPrContext: ReviewflowPrContext;
  newBody: string;
}

/** dated once github has it, so a reader refetching it gets the new body */
const updatePrCommentBody = async <Name extends EventsWithRepository>({
  appContext,
  context,
  reviewflowPrContext,
  newBody,
}: UpdatePrCommentBodyOptions<Name>): Promise<void> => {
  const { data: comment } = await context.octokit.rest.issues.updateComment(
    context.repo({
      comment_id: reviewflowPrContext.reviewflowPr.commentId,
      body: newBody,
    }),
  );
  reviewflowPrContext.commentBody = newBody;
  await recordPrActivity(appContext.mongoStores, {
    ...toPrActivityTarget(reviewflowPrContext.reviewflowPr),
    flowDate: "lastCommentActivityAt",
    at: new Date(comment.updated_at),
  });
};

export const updatePrCommentBodyIfNeeded = async <
  Name extends EventsWithRepository,
>(
  options: UpdatePrCommentBodyOptions<Name>,
): Promise<void> => {
  if (options.reviewflowPrContext.commentBody !== options.newBody) {
    await updatePrCommentBody(options);
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

  await updatePrCommentBodyIfNeeded({
    appContext: repoContext.appContext,
    context,
    reviewflowPrContext,
    newBody,
  });
};
