import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  findEnabledAccountIds,
  isLiveForAccounts,
  isPaidEnabled,
} from "./paidFeatures.ts";
import { createTestMongoStores } from "./tests/testMongoStores.ts";
import type { TestMongoStores } from "./tests/testMongoStores.ts";

describe("isPaidEnabled", () => {
  it("is off by default", () => {
    expect(isPaidEnabled({})).toBe(false);
    expect(isPaidEnabled({ paidFeatures: {} })).toBe(false);
    expect(isPaidEnabled({ paidFeatures: { enabled: false } })).toBe(false);
    expect(isPaidEnabled({ paidFeatures: { enabled: true } })).toBe(true);
  });
});

describe("isLiveForAccounts", () => {
  it("is live when at least one account is enabled", () => {
    expect(isLiveForAccounts([1, 2], new Set([2]))).toBe(true);
    expect(isLiveForAccounts([1, 2], new Set([3]))).toBe(false);
    expect(isLiveForAccounts([], new Set([3]))).toBe(false);
  });
});

describe("findEnabledAccountIds", () => {
  let stores: TestMongoStores;

  beforeAll(async () => {
    stores = await createTestMongoStores();
    await stores.orgs.upsertOne({ _id: 1, login: "on-org", installationId: 1 });
    await stores.orgs.upsertOne({
      _id: 2,
      login: "off-org",
      installationId: 2,
    });
    await stores.users.upsertOne({ _id: 3, login: "on-user", type: "User" });
    await stores.users.upsertOne({ _id: 4, login: "off-user", type: "User" });
    const paidFeatures = { enabled: true };
    await stores.orgs.partialUpdateByKey(1, { $set: { paidFeatures } });
    await stores.users.partialUpdateByKey(3, { $set: { paidFeatures } });
  });

  afterAll(async () => {
    await stores.dispose();
  });

  it("returns the enabled orgs and users among the ids", async () => {
    expect(await findEnabledAccountIds(stores, [1, 2, 3, 4, 5])).toEqual(
      new Set([1, 3]),
    );
    expect(await findEnabledAccountIds(stores, [])).toEqual(new Set());
  });

  it("is kept by a bot sync of the account", async () => {
    await stores.orgs.upsertOne({ _id: 1, login: "on-org", installationId: 9 });
    await stores.users.upsertOne({ _id: 3, login: "on-user", type: "User" });
    expect(await findEnabledAccountIds(stores, [1, 3])).toEqual(
      new Set([1, 3]),
    );
  });
});
