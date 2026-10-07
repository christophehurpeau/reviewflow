import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Query } from "mingo";
import type { ReviewflowPr } from "../mongo.ts";
import { buildPrBucketQuery } from "../prBucketCriteria.ts";
import type { TestMongoStores } from "../tests/testMongoStores.ts";
import { createTestMongoStores } from "../tests/testMongoStores.ts";

const accountId = 1;

function buildPr(
  id: string,
  overrides: Partial<ReviewflowPr> = {},
): Parameters<TestMongoStores["prs"]["insertOne"]>[0] {
  const pr: Parameters<TestMongoStores["prs"]["insertOne"]>[0] = {
    _id: id,
    account: { id: accountId, login: "acme", type: "Organization" },
    repo: { id: 10, name: "app" },
    pr: { number: Number(id) },
    commentId: 1,
    title: "title",
    isDraft: false,
    isClosed: false,
    reviews: {
      teamReviewRequested: [],
      reviewRequested: [],
      approved: [],
      changesRequested: [],
      dismissed: [],
      commented: [],
    },
    assignees: [],
    created: new Date("2020-01-01"),
    updated: new Date("2020-01-01"),
    ...overrides,
  };
  return pr;
}

describe("prsWriter.updateOne", () => {
  let stores: TestMongoStores;

  beforeAll(async () => {
    stores = await createTestMongoStores();
  });

  afterAll(async () => {
    await stores.dispose();
  });

  it("increments revision from absent, then from its value", async () => {
    await stores.prs.insertOne(buildPr("1"));

    const first = await stores.prsWriter.updateOne("1", {
      $set: { title: "a" },
    });
    expect(first.prev.revision).toBeUndefined();
    expect(first.next).toMatchObject({ title: "a", revision: 1 });

    const second = await stores.prsWriter.updateOne("1", {
      $set: { title: "b" },
    });
    expect(second.prev.revision).toBe(1);
    expect(second.next.revision).toBe(2);
    const stored = await stores.prs.findByKey("1");
    expect(stored?.revision).toBe(2);
  });

  it("moves updated", async () => {
    await stores.prs.insertOne(buildPr("2"));
    const before = new Date();

    const { prev, next } = await stores.prsWriter.updateOne("2", {
      $set: { title: "a" },
    });

    expect(prev.updated).toEqual(new Date("2020-01-01"));
    expect(next.updated.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it("keeps the caller's other operators", async () => {
    await stores.prs.insertOne(buildPr("3", { assignees: [] }));

    const { next } = await stores.prsWriter.updateOne("3", {
      $inc: { commentId: 5 },
      $unset: { headSha: true },
    });

    expect(next.commentId).toBe(6);
    expect(next.revision).toBe(1);
  });

  it("notifies a bucket leave with the stored prev when the caller mutated its copy", async () => {
    const listener = vi.fn();
    const { criteria } = buildPrBucketQuery("drafts", {
      userId: 42,
      accounts: [{ accountId, teams: [] }],
    });
    const inBucket = new Query(criteria);

    const loaded = await stores.prs.insertOne(
      buildPr("4", { isDraft: true, creator: { id: 42, login: "me" } }),
    );
    const unsubscribe = stores.prs.subscribe(listener);

    // handlers used to do this before writing, which made `prev` wrong
    loaded.isDraft = false;
    await stores.prsWriter.updateOne(loaded._id, { $set: { isDraft: false } });
    unsubscribe();

    expect(listener).toHaveBeenCalledTimes(1);
    const [action] = listener.mock.calls[0] as [
      { type: string; changes: [ReviewflowPr, ReviewflowPr][] },
    ];
    expect(action.type).toBe("updated");
    const [change] = action.changes;
    expect(inBucket.test({ ...change?.[0] })).toBe(true);
    expect(inBucket.test({ ...change?.[1] })).toBe(false);
  });

  it("rejects a caller setting revision or updated", async () => {
    await stores.prs.insertOne(buildPr("5"));
    await expect(
      stores.prsWriter.updateOne("5", { $set: { revision: 9 } }),
    ).rejects.toThrow("set by the prs writer");
    await expect(
      stores.prsWriter.updateOne("5", { $set: { updated: new Date() } }),
    ).rejects.toThrow("set by the prs writer");
  });

  it("throws on an unknown pr and does not notify", async () => {
    const listener = vi.fn();
    const unsubscribe = stores.prs.subscribe(listener);
    await expect(
      stores.prsWriter.updateOne("404", { $set: { title: "x" } }),
    ).rejects.toThrow("Pr not found");
    unsubscribe();
    expect(listener).not.toHaveBeenCalled();
  });
});
