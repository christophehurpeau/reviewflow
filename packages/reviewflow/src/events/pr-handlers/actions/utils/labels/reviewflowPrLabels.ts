import type { LabelEmbed, ReviewflowPr } from "reviewflow-core";
import type { AppContext } from "../../../../../context/AppContext.ts";
import type { PullRequestLabels } from "../../../utils/PullRequestData.ts";

export const toLabelEmbeds = (labels: PullRequestLabels): LabelEmbed[] =>
  labels.map(({ id, name }) => ({ id, name }));

const hasSameLabelIds = (
  labels: LabelEmbed[] | undefined,
  otherLabels: LabelEmbed[],
): boolean => {
  if (labels?.length !== otherLabels.length) return false;
  const ids = new Set(labels.map((label) => label.id));
  return otherLabels.every((label) => ids.has(label.id));
};

interface UpdateReviewflowPrLabelsOptions {
  appContext: AppContext;
  reviewflowPr: ReviewflowPr;
  labels: PullRequestLabels;
}

export const updateReviewflowPrLabels = async ({
  appContext,
  reviewflowPr,
  labels,
}: UpdateReviewflowPrLabelsOptions): Promise<void> => {
  const labelEmbeds = toLabelEmbeds(labels);
  if (hasSameLabelIds(reviewflowPr.labels, labelEmbeds)) return;

  reviewflowPr.labels = labelEmbeds;
  await appContext.mongoStores.prs.partialUpdateOne(reviewflowPr, {
    $set: { labels: labelEmbeds },
  });
};
