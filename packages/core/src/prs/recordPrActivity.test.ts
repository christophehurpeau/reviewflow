import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ReviewflowPr } from "../mongo.ts";
import type { TestMongoStores } from "../tests/testMongoStores.ts";
import { createTestMongoStores } from "../tests/testMongoStores.ts";
import type { PrActivity } from "./recordPrActivity.ts";
import { recordPrActivity } from "./recordPrActivity.ts";

const target = { accountId: 1, repoId: 2, number: 412 };

const activity = (at: string): PrActivity => ({
  ...target,
  flowDate: "lastCommentActivityAt",
  at: new Date(at),
});

describe("recordPrActivity", () => {
  let stores: TestMongoStores;

  const insertPr = (flowDates?: Record<string, Date>) =>
    stores.db.collection("prs").insertOne({
      _id: "pr-id" as any,
      account: { id: target.accountId, login: "acme", type: "Organization" },
      repo: { id: target.repoId, name: "api" },
      pr: { number: target.number },
      ...(flowDates ? { flowDates } : {}),
    });

  const readPr = async (): Promise<ReviewflowPr> => {
    const pr = await stores.prs.findByKey("pr-id");
    return pr!;
  };

  const readLastCommentActivityAt = async (): Promise<Date | undefined> => {
    const pr = await readPr();
    return pr.flowDates?.lastCommentActivityAt;
  };

  beforeAll(async () => {
    stores = await createTestMongoStores();
  });

  beforeEach(async () => {
    await stores.db.collection("prs").deleteMany({});
  });

  afterAll(async () => {
    await stores.dispose();
  });

  it("sets a date the pull request did not have", async () => {
    await insertPr({ createdAt: new Date("2026-10-01T09:00:00Z") });

    await recordPrActivity(stores, activity("2026-10-18T10:00:00Z"));

    expect(await readLastCommentActivityAt()).toEqual(
      new Date("2026-10-18T10:00:00Z"),
    );
  });

  it("moves a date forward, never back", async () => {
    await insertPr({ lastCommentActivityAt: new Date("2026-10-18T10:00:00Z") });

    await recordPrActivity(stores, activity("2026-10-18T09:00:00Z"));
    expect(await readLastCommentActivityAt()).toEqual(
      new Date("2026-10-18T10:00:00Z"),
    );

    await recordPrActivity(stores, activity("2026-10-18T11:00:00Z"));
    expect(await readLastCommentActivityAt()).toEqual(
      new Date("2026-10-18T11:00:00Z"),
    );
  });

  it("writes nothing for a date already recorded", async () => {
    await insertPr({ lastCommentActivityAt: new Date("2026-10-18T10:00:00Z") });

    await recordPrActivity(stores, activity("2026-10-18T10:00:00Z"));

    const pr = await readPr();
    expect(pr.updated).toBeUndefined();
  });

  it("leaves a document without flowDates untouched", async () => {
    await insertPr();

    await recordPrActivity(stores, activity("2026-10-18T10:00:00Z"));

    const pr = await readPr();
    expect(pr.flowDates).toBeUndefined();
  });
});
