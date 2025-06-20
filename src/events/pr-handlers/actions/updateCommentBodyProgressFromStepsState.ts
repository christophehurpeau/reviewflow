import type { EventsWithRepository } from "../../../context/repoContext.ts";
import type { ProbotEvent } from "../../probot-types.ts";
import type { ReviewflowPrContext } from "../utils/createPullRequestContext.ts";
import { updatePrCommentBodyIfNeeded } from "./updatePrCommentBody.ts";
import {
  defaultCommentBody,
  updateCommentBodyProgress,
} from "./utils/body/updateBody.ts";
import type { StepsState } from "./utils/steps/calcStepsState.ts";

export async function updateCommentBodyProgressFromStepsState<
  Name extends EventsWithRepository,
>(
  stepsState: StepsState,
  context: ProbotEvent<Name>,
  reviewflowPrContext: ReviewflowPrContext,
): Promise<void> {
  if (reviewflowPrContext.commentBody === defaultCommentBody) return;

  const newCommentBody = updateCommentBodyProgress(
    reviewflowPrContext.commentBody,
    stepsState,
  );

  await updatePrCommentBodyIfNeeded(
    context,
    reviewflowPrContext,
    newCommentBody,
  );
}
