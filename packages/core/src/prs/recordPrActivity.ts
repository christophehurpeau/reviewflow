import type { MongoStores, ReviewflowPr } from "../mongo.ts";

export type ActivityFlowDate =
  | "lastBodyEditedAt"
  | "lastCommentActivityAt"
  | "lastReviewCommentActivityAt";

export interface PrActivity {
  accountId: number;
  repoId: number;
  number: number;
  flowDate: ActivityFlowDate;
  at: Date;
}

export const toPrActivityTarget = ({
  account,
  repo,
  pr,
}: ReviewflowPr): Pick<PrActivity, "accountId" | "number" | "repoId"> => ({
  accountId: account.id,
  repoId: repo.id,
  number: pr.number,
});

/**
 * One write by key, without the pull request lock nor any github call. A date
 * only moves forward: a late or redelivered webhook, or the echo of an edit
 * reviewflow already dated, matches nothing, so nothing is written nor sent.
 */
export const recordPrActivity = async (
  mongoStores: MongoStores,
  { accountId, repoId, number, flowDate, at }: PrActivity,
): Promise<void> => {
  const path = `flowDates.${flowDate}` as const;
  const $set: Partial<Record<typeof path, Date>> = { [path]: at };
  const notLaterThanAt: Partial<Record<typeof path, { $not: { $gte: Date } }>> =
    { [path]: { $not: { $gte: at } } };
  await mongoStores.prs.partialUpdateMany(
    {
      "account.id": accountId,
      "repo.id": repoId,
      "pr.number": number,
      flowDates: { $exists: true },
      ...notLaterThanAt,
    },
    { $set },
  );
};
