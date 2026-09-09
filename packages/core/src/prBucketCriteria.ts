import type { Criteria, Sort } from "liwi-store";
import type { PrBucket } from "reviewflow-modules";
import type { OrgTeamEmbed, ReviewflowPr } from "./mongo.ts";

export interface PrBucketAccount {
  accountId: number;
  /**
   * Empty for a personal account, and older org member documents were stored
   * without any team.
   */
  teams: OrgTeamEmbed[] | undefined;
}

interface PrBucketContext {
  userId: number;
  /** every account the query spans, one entry when a single one is selected */
  accounts: PrBucketAccount[];
}

export interface PrBucketQuery {
  criteria: Criteria<ReviewflowPr>;
  sort: Sort<ReviewflowPr>;
}

const emptyReviews = { $exists: true, $eq: [] };
const someReviews = { $exists: true, $ne: [] };
const noReviews = { $not: { $exists: true, $ne: [] } };

/** mongo rejects an empty `$or`, an empty `$in` is the criteria matching nothing */
const anyOf = (clauses: Criteria<ReviewflowPr>[]): Criteria<ReviewflowPr> => {
  if (clauses.length === 0) return { "account.id": { $in: [] } };
  if (clauses.length === 1) return clauses[0]!;
  return { $or: clauses };
};

const accountIdsCriteria = (
  accounts: PrBucketAccount[],
): Criteria<ReviewflowPr> => ({
  "account.id": { $in: accounts.map((account) => account.accountId) },
});

const buildAccountRequestedReviewsCriteria = (
  { accountId, teams }: PrBucketAccount,
  userId: number,
): Criteria<ReviewflowPr> =>
  teams && teams.length > 0
    ? {
        "account.id": accountId,
        $or: [
          { "reviews.reviewRequested.id": userId },
          {
            "reviews.teamReviewRequested.id": {
              $in: teams.map((team) => team.id),
            },
          },
        ],
      }
    : { "account.id": accountId, "reviews.reviewRequested.id": userId };

/**
 * teams are per org, so review requests cannot be matched with a single `$in`.
 *
 * Both review buckets ask for a pending request and differ only on whether the
 * user has reviewed this pull request before, so together they cover every
 * requested review exactly once. Reviewing again is a request like any other:
 * pressing "start review" comments and asks for the review again, which is what
 * moves the pull request from one bucket to the other.
 */
const buildRequestedReviewsCriteria = (
  { accounts, userId }: PrBucketContext,
  reviewedBefore: boolean,
): Criteria<ReviewflowPr> => ({
  isClosed: false,
  isDraft: false,
  "reviews.reviewed.id": reviewedBefore ? userId : { $ne: userId },
  ...anyOf(
    accounts.map((account) =>
      buildAccountRequestedReviewsCriteria(account, userId),
    ),
  ),
});

const buildAssignedCriteria = (
  { accounts, userId }: PrBucketContext,
  extra: Criteria<ReviewflowPr>,
): Criteria<ReviewflowPr> => ({
  ...accountIdsCriteria(accounts),
  "assignees.id": userId,
  isClosed: false,
  ...extra,
});

/**
 * The same buckets the slack home surfaces, so both stay in sync.
 */
export const buildPrBucketQuery = (
  bucket: PrBucket,
  context: PrBucketContext,
): PrBucketQuery => {
  switch (bucket) {
    case "requested-reviews":
      return {
        criteria: buildRequestedReviewsCriteria(context, false),
        sort: { "flowDates.openedAt": -1, created: -1 },
      };

    case "re-requested-reviews":
      return {
        criteria: buildRequestedReviewsCriteria(context, true),
        sort: { "flowDates.openedAt": -1, created: -1 },
      };

    case "ready-to-merge":
      return {
        criteria: buildAssignedCriteria(context, {
          "reviews.teamReviewRequested": emptyReviews,
          "reviews.reviewRequested": emptyReviews,
          "reviews.changesRequested": emptyReviews,
          "reviews.approved": someReviews,
        }),
        sort: { created: -1 },
      };

    case "changes-requested":
      return {
        criteria: buildAssignedCriteria(context, {
          "reviews.changesRequested": someReviews,
        }),
        sort: { created: -1 },
      };

    case "drafts":
      return {
        criteria: buildAssignedCriteria(context, { isDraft: true }),
        sort: { created: -1 },
      };

    case "opened-missing-review-request":
      return {
        criteria: buildAssignedCriteria(context, {
          isDraft: false,
          "reviews.teamReviewRequested": noReviews,
          "reviews.reviewRequested": noReviews,
          "reviews.changesRequested": noReviews,
          "reviews.approved": noReviews,
        }),
        sort: { created: -1 },
      };

    case "waiting-for-review":
      return {
        criteria: buildAssignedCriteria(context, {
          isDraft: false,
          $or: [
            { "reviews.teamReviewRequested": someReviews },
            { "reviews.reviewRequested": someReviews },
          ],
        }),
        sort: { created: -1 },
      };

    default:
      throw new Error(`Unknown bucket: ${bucket as string}`);
  }
};
