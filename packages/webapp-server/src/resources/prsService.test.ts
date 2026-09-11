import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResourcesServerError } from "liwi-resources-server";
import type { MongoStores, ReviewflowPr } from "reviewflow-core";
import type { AuthenticatedWsUser } from "./getAuthenticatedUser.ts";
import { createPrsService } from "./prsService.ts";

const { createReviewAsUser, requestOwnReviewAgain } = vi.hoisted(() => ({
  createReviewAsUser: vi.fn<() => Promise<void>>(),
  requestOwnReviewAgain: vi.fn<() => Promise<boolean>>(),
}));

vi.mock("../github/reviewAsUser.ts", () => ({
  createReviewAsUser,
  requestOwnReviewAgain,
}));

const loggedInUser: AuthenticatedWsUser = {
  id: 42,
  login: "christophehurpeau",
  accessToken: "gh-token",
};

const buildPr = (overrides: Partial<ReviewflowPr> = {}): ReviewflowPr =>
  ({
    _id: "pr-id",
    account: { id: 1, login: "org", type: "Organization" },
    repo: { id: 2, name: "repo" },
    pr: { number: 412 },
    isClosed: false,
    ...overrides,
  }) as unknown as ReviewflowPr;

interface Stores {
  mongoStores: MongoStores;
  partialUpdateOne: ReturnType<typeof vi.fn>;
}

/** the user is a member of org 1, and of nothing else */
const createStores = (pr: ReviewflowPr | undefined): Stores => {
  const partialUpdateOne = vi.fn(() => Promise.resolve());
  const mongoStores: any = {
    prs: { findByKey: () => Promise.resolve(pr), partialUpdateOne },
    orgMembers: {
      findOne: ({ "org.id": orgId }: Record<string, number>) =>
        Promise.resolve(
          orgId === 1
            ? { _id: "1_42", org: { id: 1, login: "org" }, user: { id: 42 } }
            : null,
        ),
    },
    orgs: {
      findByKey: (orgId: number) =>
        Promise.resolve(orgId === 1 ? { _id: 1, login: "org" } : undefined),
    },
  };

  return { mongoStores, partialUpdateOne };
};

const startReview = (mongoStores: MongoStores) =>
  createPrsService({ mongoStores }).operations.startReview(
    { prId: "pr-id" },
    loggedInUser,
  );

describe("startReview", () => {
  beforeEach(() => {
    createReviewAsUser.mockReset();
    createReviewAsUser.mockResolvedValue(undefined);
    requestOwnReviewAgain.mockReset();
    requestOwnReviewAgain.mockResolvedValue(true);
  });

  const buildReviews = (
    overrides: Partial<ReviewflowPr["reviews"]> = {},
  ): Partial<ReviewflowPr> => ({
    reviews: {
      approved: [],
      changesRequested: [],
      reviewRequested: [],
      teamReviewRequested: [],
      dismissed: [],
      commented: [],
      reviewed: [],
      ...overrides,
    },
  });

  it("comments as the user, then asks for their review again", async () => {
    const { mongoStores, partialUpdateOne } = createStores(
      buildPr(buildReviews({ reviewRequested: [{ id: 42, login: "chris" }] })),
    );

    await startReview(mongoStores);

    expect(createReviewAsUser).toHaveBeenCalledWith(
      "gh-token",
      expect.objectContaining({ _id: "pr-id" }),
    );
    expect(requestOwnReviewAgain).toHaveBeenCalledWith(
      "gh-token",
      expect.objectContaining({ _id: "pr-id" }),
      "christophehurpeau",
    );
    expect(partialUpdateOne).toHaveBeenCalledTimes(1);

    const [, update] = partialUpdateOne.mock.calls[0]!;
    expect(update.$set.reviews.reviewed).toEqual([
      { id: 42, login: "christophehurpeau" },
    ]);
    expect(update.$set.reviews.reviewRequested).toEqual([
      { id: 42, login: "christophehurpeau" },
    ]);
  });

  it("asks only once the review comment landed", async () => {
    const { mongoStores } = createStores(buildPr(buildReviews()));
    const order: string[] = [];
    createReviewAsUser.mockImplementation(() => {
      order.push("review");
      return Promise.resolve();
    });
    requestOwnReviewAgain.mockImplementation(() => {
      order.push("request");
      return Promise.resolve(true);
    });

    await startReview(mongoStores);

    expect(order).toEqual(["review", "request"]);
  });

  /** the whole reason for asking again: a comment leaves the approval standing */
  it("takes a standing approval by the reviewer out of the count", async () => {
    const { mongoStores, partialUpdateOne } = createStores(
      buildPr(
        buildReviews({
          approved: [
            { id: 42, login: "christophehurpeau" },
            { id: 7, login: "dan" },
          ],
          reviewed: [
            { id: 42, login: "christophehurpeau", endedAt: new Date() },
            { id: 7, login: "dan", endedAt: new Date() },
          ],
        }),
      ),
    );

    await startReview(mongoStores);

    const { reviews } = partialUpdateOne.mock.calls[0]![1].$set;
    expect(reviews.approved).toEqual([{ id: 7, login: "dan" }]);
    expect(reviews.reviewRequested).toEqual([
      { id: 42, login: "christophehurpeau" },
    ]);
  });

  /** it needs push access, which a reviewer has not necessarily got */
  it("records only the review when github refused to ask again", async () => {
    const { mongoStores, partialUpdateOne } = createStores(
      buildPr(buildReviews({ approved: [{ id: 42, login: "chris" }] })),
    );
    requestOwnReviewAgain.mockResolvedValue(false);

    await startReview(mongoStores);

    // only that they reviewed, the rest left for the webhook to reconcile
    const [, update] = partialUpdateOne.mock.calls[0]!;
    expect(update).toEqual({
      $set: {
        "reviews.reviewed": [{ id: 42, login: "christophehurpeau" }],
      },
    });
  });

  /** the slack link redirects to whatever this says, so it never comes in */
  it("answers with the pull request url", async () => {
    const { mongoStores } = createStores(buildPr());

    await expect(startReview(mongoStores)).resolves.toEqual({
      prUrl: "https://github.com/org/repo/pull/412",
    });
  });

  const askedAgain = () =>
    buildReviews({
      reviewRequested: [{ id: 42, login: "christophehurpeau" }],
      reviewed: [{ id: 42, login: "christophehurpeau" }],
    });

  it("does nothing at all when the review is already asked again", async () => {
    const { mongoStores, partialUpdateOne } = createStores(
      buildPr(askedAgain()),
    );

    // still the url: following the slack link twice must still reach github
    await expect(startReview(mongoStores)).resolves.toEqual({
      prUrl: "https://github.com/org/repo/pull/412",
    });

    expect(createReviewAsUser).not.toHaveBeenCalled();
    expect(requestOwnReviewAgain).not.toHaveBeenCalled();
    expect(partialUpdateOne).not.toHaveBeenCalled();
  });

  /** a decision with no pending request is a finished review, not one asked again */
  it("comments again once the reviewer had decided and nobody asked", async () => {
    const { mongoStores } = createStores(
      buildPr(
        buildReviews({
          approved: [{ id: 42, login: "christophehurpeau" }],
          reviewed: [
            {
              id: 42,
              login: "christophehurpeau",
              endedAt: new Date("2026-02-01T10:00:00Z"),
            },
          ],
        }),
      ),
    );

    await startReview(mongoStores);

    expect(createReviewAsUser).toHaveBeenCalled();
    expect(requestOwnReviewAgain).toHaveBeenCalled();
  });

  it("rejects an unknown pull request without calling github", async () => {
    const { mongoStores, partialUpdateOne } = createStores(undefined);

    await expect(startReview(mongoStores)).rejects.toThrow(
      ResourcesServerError,
    );
    expect(createReviewAsUser).not.toHaveBeenCalled();
    expect(partialUpdateOne).not.toHaveBeenCalled();
  });

  it("rejects an account the user does not belong to without calling github", async () => {
    const { mongoStores, partialUpdateOne } = createStores(
      buildPr({ account: { id: 99, login: "other", type: "Organization" } }),
    );

    await expect(startReview(mongoStores)).rejects.toThrow(
      "You are not a member of this organization",
    );
    expect(createReviewAsUser).not.toHaveBeenCalled();
    expect(partialUpdateOne).not.toHaveBeenCalled();
  });

  it("rejects a closed pull request without calling github", async () => {
    const { mongoStores, partialUpdateOne } = createStores(
      buildPr({ isClosed: true }),
    );

    await expect(startReview(mongoStores)).rejects.toThrow(
      "This pull request is closed",
    );
    expect(createReviewAsUser).not.toHaveBeenCalled();
    expect(partialUpdateOne).not.toHaveBeenCalled();
  });

  it("records nothing when github refused the review", async () => {
    const { mongoStores, partialUpdateOne } = createStores(buildPr());
    createReviewAsUser.mockRejectedValue(
      new ResourcesServerError(
        "BAD_REQUEST",
        "Can not approve your own pull request",
      ),
    );

    await expect(startReview(mongoStores)).rejects.toThrow(
      "Can not approve your own pull request",
    );
    expect(partialUpdateOne).not.toHaveBeenCalled();
  });

  /**
   * The document deciding whether there is anything to start is written back
   * only once github answered, so a second send inside that window would read
   * the same pre-write document and comment again.
   */
  it("answers a send arriving while an earlier one is still in flight with it", async () => {
    const { mongoStores, partialUpdateOne } = createStores(
      buildPr(buildReviews()),
    );
    const service = createPrsService({ mongoStores });

    const results = await Promise.all([
      service.operations.startReview({ prId: "pr-id" }, loggedInUser),
      service.operations.startReview({ prId: "pr-id" }, loggedInUser),
    ]);

    expect(results).toEqual([
      { prUrl: "https://github.com/org/repo/pull/412" },
      { prUrl: "https://github.com/org/repo/pull/412" },
    ]);
    expect(createReviewAsUser).toHaveBeenCalledTimes(1);
    expect(partialUpdateOne).toHaveBeenCalledTimes(1);
  });

  /** deduplicating is for one send in two, never for the next press */
  it("starts again once the earlier send answered", async () => {
    const { mongoStores } = createStores(buildPr(buildReviews()));
    const service = createPrsService({ mongoStores });

    await service.operations.startReview({ prId: "pr-id" }, loggedInUser);
    await service.operations.startReview({ prId: "pr-id" }, loggedInUser);

    expect(createReviewAsUser).toHaveBeenCalledTimes(2);
  });

  it("refuses an unauthenticated caller", async () => {
    const { mongoStores } = createStores(buildPr());

    await expect(
      createPrsService({ mongoStores }).operations.startReview(
        { prId: "pr-id" },
        undefined,
      ),
    ).rejects.toThrow("Not authenticated");
    expect(createReviewAsUser).not.toHaveBeenCalled();
  });
});
