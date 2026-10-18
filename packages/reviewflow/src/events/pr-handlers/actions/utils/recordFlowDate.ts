import type { AppContext } from "../../../../context/AppContext.ts";
import type { ReviewflowPrContext } from "../../utils/createPullRequestContext.ts";

export type ActivityFlowDate =
  | "lastBodyEditedAt"
  | "lastCommentActivityAt"
  | "lastReviewCommentActivityAt";

/**
 * Something other than reviewflow moved on the pull request. Only the date is
 * kept: readers learn that the pull request moved and re-read it on github.
 */
export const recordFlowDate = async (
  appContext: AppContext,
  reviewflowPrContext: ReviewflowPrContext | null,
  flowDate: ActivityFlowDate,
  at: Date,
): Promise<void> => {
  const reviewflowPr = reviewflowPrContext?.reviewflowPr;
  if (!reviewflowPr?.flowDates) return;
  const $set: Partial<Record<`flowDates.${ActivityFlowDate}`, Date>> = {
    [`flowDates.${flowDate}`]: at,
  };
  await appContext.mongoStores.prs.partialUpdateOne(reviewflowPr, { $set });
};
