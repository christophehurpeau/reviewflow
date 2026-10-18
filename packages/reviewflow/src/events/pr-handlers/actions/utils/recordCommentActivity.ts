import type { AppContext } from "../../../../context/AppContext.ts";
import type { ReviewflowPrContext } from "../../utils/createPullRequestContext.ts";

/**
 * A comment of the conversation (not of a review) was created, edited or
 * deleted. Only the date is kept: readers learn that the pull request moved
 * and re-read it on github.
 */
export const recordCommentActivity = async (
  appContext: AppContext,
  reviewflowPrContext: ReviewflowPrContext | null,
  at: Date,
): Promise<void> => {
  const reviewflowPr = reviewflowPrContext?.reviewflowPr;
  if (!reviewflowPr?.flowDates) return;
  await appContext.mongoStores.prs.partialUpdateOne(reviewflowPr, {
    $set: { "flowDates.lastCommentActivityAt": at },
  });
};
