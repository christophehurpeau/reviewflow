import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TestMongoStores } from "./tests/testMongoStores.ts";
import { createTestMongoStores } from "./tests/testMongoStores.ts";

describe("mongo stores on a real mongod", () => {
  let stores: TestMongoStores;

  beforeAll(async () => {
    stores = await createTestMongoStores();
  });

  afterAll(async () => {
    await stores.dispose();
  });

  it("inserts, partially updates and reads back an org", async () => {
    const inserted = await stores.orgs.insertOne({
      _id: 1,
      login: "acme",
      config: {},
      status: "active",
    });
    expect(inserted.login).toBe("acme");

    await stores.orgs.partialUpdateOne(inserted, {
      $set: { status: "suspended" },
    });

    const found = await stores.orgs.findByKey(1);
    expect(found).toMatchObject({ login: "acme", status: "suspended" });
  });

  it("creates the slackSentMessages index on a database without collections", async () => {
    const indexes = await stores.db.collection("slackSentMessages").indexes();
    expect(indexes.map(({ name }) => name)).toContain(
      "account.id_1_account.type_1_type_1_typeId_1_messageId_1",
    );
  });

  // index created by `init`
  it("enforces the unique index on org login", async () => {
    await expect(
      stores.orgs.insertOne({
        _id: 2,
        login: "acme",
        config: {},
        status: "active",
      }),
    ).rejects.toThrow();
  });
});
