import { describe, expect, it } from "vitest";
import { buildPrBucketQuery } from "./prBucketCriteria.ts";

// mongo criteria are typed as a partial model, dotted paths and $or are not in it
const criteriaOf = (...args: Parameters<typeof buildPrBucketQuery>): any =>
  buildPrBucketQuery(...args).criteria;

const orgWithTeams = {
  accountId: 1,
  teams: [{ id: 9, name: "dev", slug: "dev" }],
};
const orgWithoutTeams = { accountId: 1, teams: [] };
const otherOrg = { accountId: 2, teams: [{ id: 8, name: "ops", slug: "ops" }] };
const personalAccount = { accountId: 42, teams: [] };

const withTeams = { userId: 42, accounts: [orgWithTeams] };
const withoutTeams = { userId: 42, accounts: [orgWithoutTeams] };
const acrossOrgs = { userId: 42, accounts: [orgWithTeams, otherOrg] };
const withPersonalAccount = {
  userId: 42,
  accounts: [personalAccount, orgWithTeams],
};
const withoutAccount = { userId: 42, accounts: [] };

const buckets = [
  "requested-reviews",
  "ready-to-merge",
  "changes-requested",
  "drafts",
  "no-action-planned",
  "waiting-for-review",
] as const;

describe("buildPrBucketQuery", () => {
  it("scopes every bucket to the org and to open pull requests", () => {
    for (const bucket of buckets) {
      const criteria = criteriaOf(bucket, withTeams);
      expect(criteria.isClosed).toBe(false);
      expect(criteria["account.id"]).toEqual(
        bucket === "requested-reviews" ? 1 : { $in: [1] },
      );
    }
  });

  it("matches team review requests when the user belongs to a team", () => {
    const criteria = criteriaOf("requested-reviews", withTeams);

    expect(criteria["account.id"]).toBe(1);
    expect(criteria.$or).toEqual([
      { "reviews.reviewRequested.id": 42 },
      { "reviews.teamReviewRequested.id": { $in: [9] } },
    ]);
  });

  it("matches only direct review requests without a team", () => {
    const criteria = criteriaOf("requested-reviews", withoutTeams);

    expect(criteria.$or).toBeUndefined();
    expect(criteria["reviews.reviewRequested.id"]).toBe(42);
  });

  it("keeps teams attached to their own org across orgs", () => {
    const criteria = criteriaOf("requested-reviews", acrossOrgs);

    expect(criteria.$or).toEqual([
      {
        "account.id": 1,
        $or: [
          { "reviews.reviewRequested.id": 42 },
          { "reviews.teamReviewRequested.id": { $in: [9] } },
        ],
      },
      {
        "account.id": 2,
        $or: [
          { "reviews.reviewRequested.id": 42 },
          { "reviews.teamReviewRequested.id": { $in: [8] } },
        ],
      },
    ]);
  });

  it("spans every org of the assigned buckets", () => {
    const criteria = criteriaOf("ready-to-merge", acrossOrgs);

    expect(criteria["account.id"]).toEqual({ $in: [1, 2] });
  });

  it("spans the personal account alongside the orgs", () => {
    expect(
      criteriaOf("ready-to-merge", withPersonalAccount)["account.id"],
    ).toEqual({ $in: [42, 1] });

    expect(criteriaOf("requested-reviews", withPersonalAccount).$or).toEqual([
      { "account.id": 42, "reviews.reviewRequested.id": 42 },
      {
        "account.id": 1,
        $or: [
          { "reviews.reviewRequested.id": 42 },
          { "reviews.teamReviewRequested.id": { $in: [9] } },
        ],
      },
    ]);
  });

  it("matches nothing when the user has no account", () => {
    for (const bucket of buckets) {
      expect(criteriaOf(bucket, withoutAccount)["account.id"]).toEqual({
        $in: [],
      });
    }
  });

  it("requires an approval and no pending review to be ready to merge", () => {
    const criteria = criteriaOf("ready-to-merge", withTeams);

    expect(criteria).toMatchObject({
      "assignees.id": 42,
      "reviews.approved": { $exists: true, $ne: [] },
      "reviews.changesRequested": { $exists: true, $eq: [] },
      "reviews.reviewRequested": { $exists: true, $eq: [] },
      "reviews.teamReviewRequested": { $exists: true, $eq: [] },
    });
  });

  it("only returns drafts assigned to the user", () => {
    const criteria = criteriaOf("drafts", withTeams);

    expect(criteria).toMatchObject({ "assignees.id": 42, isDraft: true });
  });

  it("excludes drafts from the buckets about open pull requests", () => {
    for (const bucket of [
      "requested-reviews",
      "no-action-planned",
      "waiting-for-review",
    ] as const) {
      expect(buildPrBucketQuery(bucket, withTeams).criteria.isDraft).toBe(
        false,
      );
    }
  });
});
