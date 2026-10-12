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

  it("indexes prs on account id, repo id and head branch", async () => {
    const indexes = await stores.db.collection("prs").indexes();
    expect(indexes.map(({ name }) => name)).toContain(
      "account.id_1_repo.id_1_headRef_1",
    );
  });

  it("indexes prs on account id, repo id and base branch", async () => {
    const indexes = await stores.db.collection("prs").indexes();
    expect(indexes.map(({ name }) => name)).toContain(
      "account.id_1_repo.id_1_baseRef_1",
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

  it("indexes personal tokens on their hash and on their owner", async () => {
    const indexes = await stores.db.collection("personalTokens").indexes();
    expect(indexes.map(({ name }) => name)).toEqual(
      expect.arrayContaining(["hash_1", "userId_1_created_-1"]),
    );
  });

  it("rejects a second personal token with the same hash", async () => {
    const token = {
      userId: 42,
      userLogin: "christophehurpeau",
      name: "vigie",
      hash: "abc",
      prefix: "rfp_abcd",
    };
    await stores.personalTokens.insertOne({ ...token });

    await expect(
      stores.personalTokens.insertOne({ ...token, name: "other" }),
    ).rejects.toThrow();
  });
});
