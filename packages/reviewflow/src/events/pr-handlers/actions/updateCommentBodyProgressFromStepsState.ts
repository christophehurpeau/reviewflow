import type { AppContext } from "../../../context/AppContext.ts";
import type { EventsWithRepository } from "../../../context/repoContext.ts";
import type { ProbotEvent } from "../../probot-types.ts";
import type { ReviewflowPrContext } from "../utils/createPullRequestContext.ts";
import { updatePrCommentBodyIfNeeded } from "./updatePrCommentBody.ts";
import {
  defaultCommentBody,
  updateCommentBodyProgress,
} from "./utils/body/updateBody.ts";
import type { StepsState } from "./utils/steps/calcStepsState.ts";

interface UpdateCommentBodyProgressOptions<Name extends EventsWithRepository> {
  appContext: AppContext;
  stepsState: StepsState;
  context: ProbotEvent<Name>;
  reviewflowPrContext: ReviewflowPrContext;
}

export async function updateCommentBodyProgressFromStepsState<
  Name extends EventsWithRepository,
>({
  appContext,
  stepsState,
  context,
  reviewflowPrContext,
}: UpdateCommentBodyProgressOptions<Name>): Promise<void> {
  if (reviewflowPrContext.commentBody === defaultCommentBody) return;

  const newCommentBody = updateCommentBodyProgress(
    reviewflowPrContext.commentBody,
    stepsState,
  );

  await updatePrCommentBodyIfNeeded({
    appContext,
    context,
    reviewflowPrContext,
    newBody: newCommentBody,
  });
}
