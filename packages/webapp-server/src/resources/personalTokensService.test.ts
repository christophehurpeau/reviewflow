import { describe, expect, it, vi } from "vitest";
import { ResourcesServerError } from "liwi-resources-server";
import { NotFoundError } from "liwi-store";
import type { MongoStores, PersonalToken } from "reviewflow-core";
import { hashPersonalToken } from "../auth/personalTokens.ts";
import type { AuthenticatedWsUser } from "./getAuthenticatedUser.ts";
import { createPersonalTokensService } from "./personalTokensService.ts";

const loggedInUser: AuthenticatedWsUser = {
  id: 42,
  login: "christophehurpeau",
  accessToken: "gh-token",
};

const activeCriteria = { userId: 42, revokedAt: { $exists: false } };

const existingToken: PersonalToken = {
  _id: "token-id",
  userId: 42,
  name: "vigie on MacBook",
  hash: "hash",
  prefix: "rfp_abcd",
  created: new Date("2026-10-01"),
  updated: new Date("2026-10-01"),
};

interface Stores {
  mongoStores: MongoStores;
  insertOne: ReturnType<typeof vi.fn>;
  partialUpdateByKey: ReturnType<typeof vi.fn>;
  createQueryCollection: ReturnType<typeof vi.fn>;
}

interface CreateStoresOptions {
  activeCount?: number;
  /** what the revoke filter matches: nothing for an unknown, revoked or foreign token */
  revocable?: PersonalToken;
}

const createStores = ({
  activeCount = 0,
  revocable,
}: CreateStoresOptions = {}): Stores => {
  const insertOne = vi.fn((object: Partial<PersonalToken>) =>
    Promise.resolve({ ...object, _id: "new-token-id" }),
  );
  const partialUpdateByKey = vi.fn(() =>
    revocable
      ? Promise.resolve({ ...revocable, revokedAt: new Date() })
      : Promise.reject(new NotFoundError("Document not found")),
  );
  const createQueryCollection = vi.fn(() => "query");

  const mongoStores: any = {
    personalTokens: {
      count: () => Promise.resolve(activeCount),
      insertOne,
      partialUpdateByKey,
      createQueryCollection,
    },
  };

  return { mongoStores, insertOne, partialUpdateByKey, createQueryCollection };
};

const unauthenticated = expect.objectContaining({ code: "UNAUTHENTICATED" });

describe("queryMyPersonalTokens", () => {
  it("lists the user's active tokens, newest first", () => {
    const { mongoStores, createQueryCollection } = createStores();

    createPersonalTokensService({ mongoStores }).queries.queryMyPersonalTokens(
      {},
      loggedInUser,
    );

    expect(createQueryCollection).toHaveBeenCalledWith(
      expect.objectContaining({
        criteria: activeCriteria,
        sort: { created: -1 },
      }),
    );
  });

  it("never exposes the hash", () => {
    const { mongoStores, createQueryCollection } = createStores();
    createPersonalTokensService({ mongoStores }).queries.queryMyPersonalTokens(
      {},
      loggedInUser,
    );
    const [{ transformer }] = createQueryCollection.mock.calls[0] as [
      { transformer: (token: PersonalToken) => unknown },
    ];

    expect(transformer(existingToken)).toEqual({
      _id: "token-id",
      name: "vigie on MacBook",
      prefix: "rfp_abcd",
      createdAt: existingToken.created,
      lastUsedAt: undefined,
      lastUsedIp: undefined,
    });
  });

  it("requires a session", () => {
    const { mongoStores } = createStores();

    expect(() =>
      createPersonalTokensService({
        mongoStores,
      }).queries.queryMyPersonalTokens({}, undefined),
    ).toThrow(ResourcesServerError);
  });
});

describe("createPersonalToken", () => {
  const create = (mongoStores: MongoStores, name: string) =>
    createPersonalTokensService({ mongoStores }).operations.createPersonalToken(
      { name },
      loggedInUser,
    );

  it("stores the hash and returns the token once", async () => {
    const { mongoStores, insertOne } = createStores();

    const created = await create(mongoStores, "  vigie on MacBook ");

    expect(created._id).toBe("new-token-id");
    expect(insertOne).toHaveBeenCalledWith({
      userId: 42,
      name: "vigie on MacBook",
      hash: hashPersonalToken(created.token),
      prefix: created.token.slice(0, 8),
    });
    expect(JSON.stringify(insertOne.mock.calls)).not.toContain(created.token);
  });

  it.each(["", "   ", "a".repeat(101)])("rejects the name %j", async (name) => {
    const { mongoStores, insertOne } = createStores();

    await expect(create(mongoStores, name)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(insertOne).not.toHaveBeenCalled();
  });

  it("accepts a name of 100 characters", async () => {
    const { mongoStores, insertOne } = createStores();

    await create(mongoStores, "a".repeat(100));

    expect(insertOne).toHaveBeenCalled();
  });

  it("refuses a 21st active token", async () => {
    const { mongoStores, insertOne } = createStores({ activeCount: 20 });

    await expect(create(mongoStores, "vigie")).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(insertOne).not.toHaveBeenCalled();
  });

  it("requires a session", async () => {
    const { mongoStores } = createStores();

    await expect(
      createPersonalTokensService({
        mongoStores,
      }).operations.createPersonalToken({ name: "vigie" }, undefined),
    ).rejects.toEqual(unauthenticated);
  });
});

describe("revokePersonalToken", () => {
  const revoke = (mongoStores: MongoStores) =>
    createPersonalTokensService({ mongoStores }).operations.revokePersonalToken(
      { tokenId: "token-id" },
      loggedInUser,
    );

  it("revokes only an active token of the user", async () => {
    const { mongoStores, partialUpdateByKey } = createStores({
      revocable: existingToken,
    });

    await revoke(mongoStores);

    expect(partialUpdateByKey).toHaveBeenCalledWith(
      "token-id",
      { $set: { revokedAt: expect.any(Date) } },
      activeCriteria,
    );
  });

  it("answers an unknown, revoked or foreign token with NOT_FOUND", async () => {
    const { mongoStores } = createStores();

    await expect(revoke(mongoStores)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("requires a session", async () => {
    const { mongoStores } = createStores({ revocable: existingToken });

    await expect(
      createPersonalTokensService({
        mongoStores,
      }).operations.revokePersonalToken({ tokenId: "token-id" }, undefined),
    ).rejects.toEqual(unauthenticated);
  });
});

describe("regeneratePersonalToken", () => {
  const regenerate = (mongoStores: MongoStores) =>
    createPersonalTokensService({
      mongoStores,
    }).operations.regeneratePersonalToken(
      { tokenId: "token-id" },
      loggedInUser,
    );

  it("revokes the token, then creates a new one under its name", async () => {
    const { mongoStores, partialUpdateByKey, insertOne } = createStores({
      revocable: existingToken,
    });

    const created = await regenerate(mongoStores);

    expect(partialUpdateByKey).toHaveBeenCalledWith(
      "token-id",
      { $set: { revokedAt: expect.any(Date) } },
      activeCriteria,
    );
    expect(insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 42,
        name: "vigie on MacBook",
        hash: hashPersonalToken(created.token),
      }),
    );
    expect(partialUpdateByKey.mock.invocationCallOrder[0]).toBeLessThan(
      insertOne.mock.invocationCallOrder[0]!,
    );
  });

  it("creates nothing for an unknown, revoked or foreign token", async () => {
    const { mongoStores, insertOne } = createStores();

    await expect(regenerate(mongoStores)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(insertOne).not.toHaveBeenCalled();
  });

  it("requires a session", async () => {
    const { mongoStores } = createStores({ revocable: existingToken });

    await expect(
      createPersonalTokensService({
        mongoStores,
      }).operations.regeneratePersonalToken({ tokenId: "token-id" }, undefined),
    ).rejects.toEqual(unauthenticated);
  });
});
