import type { Criteria, Sort } from "liwi-store";
import type { PrBucket } from "reviewflow-modules";
import type { OrgTeamEmbed, ReviewflowPr } from "./mongo.ts";

export interface PrBucketOrg {
  orgId: number;
  /** older org member documents were stored without any team */
  teams: OrgTeamEmbed[] | undefined;
}

interface PrBucketContext {
  userId: number;
  /** every org the query spans, one entry when a single org is selected */
  orgs: PrBucketOrg[];
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

const orgIdsCriteria = (orgs: PrBucketOrg[]): Criteria<ReviewflowPr> => ({
  "account.id": { $in: orgs.map((org) => org.orgId) },
});

const buildOrgRequestedReviewsCriteria = (
  { orgId, teams }: PrBucketOrg,
  userId: number,
): Criteria<ReviewflowPr> =>
  teams && teams.length > 0
    ? {
        "account.id": orgId,
        $or: [
          { "reviews.reviewRequested.id": userId },
          {
            "reviews.teamReviewRequested.id": {
              $in: teams.map((team) => team.id),
            },
          },
        ],
      }
    : { "account.id": orgId, "reviews.reviewRequested.id": userId };

/** teams are per org, so review requests cannot be matched with a single `$in` */
const buildRequestedReviewsCriteria = ({
  orgs,
  userId,
}: PrBucketContext): Criteria<ReviewflowPr> => ({
  isClosed: false,
  isDraft: false,
  ...anyOf(orgs.map((org) => buildOrgRequestedReviewsCriteria(org, userId))),
});

const buildAssignedCriteria = (
  { orgs, userId }: PrBucketContext,
  extra: Criteria<ReviewflowPr>,
): Criteria<ReviewflowPr> => ({
  ...orgIdsCriteria(orgs),
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
        criteria: buildRequestedReviewsCriteria(context),
        sort: { "flowDates.opened": -1, created: -1 },
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

    case "no-action-planned":
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
