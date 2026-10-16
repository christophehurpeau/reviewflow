import { describe, expect, it, vi } from "vitest";
import type { MongoStores, OrgMember } from "reviewflow-core";
import { createSlackUserTokensCheck } from "./slackUserToken.ts";

const slackError = (error: string): Error =>
  Object.assign(new Error(error), { data: { ok: false, error } });

const orgMember = (
  id: string,
  token: string,
  tokenRevokedAt?: Date,
): OrgMember =>
  ({
    _id: id,
    slack: { id: "U1", accessToken: token, tokenRevokedAt },
  }) as unknown as OrgMember;

const setup = (orgMembers: OrgMember[]) => {
  const findAll = vi.fn(() => Promise.resolve(orgMembers));
  const partialUpdateMany = vi.fn(() => Promise.resolve());
  const mongoStores = {
    orgMembers: { findAll, partialUpdateMany },
  } as unknown as MongoStores;
  return { mongoStores, findAll, partialUpdateMany };
};

describe("createSlackUserTokensCheck", () => {
  it("reads every membership of the user holding a token", async () => {
    const { mongoStores, findAll } = setup([]);

    await createSlackUserTokensCheck(mongoStores, vi.fn())(42);

    expect(findAll).toHaveBeenCalledWith({
      "user.id": 42,
      "slack.accessToken": { $exists: true },
    });
  });

  it("records a token slack refuses, only while it is still the stored one", async () => {
    const { mongoStores, partialUpdateMany } = setup([
      orgMember("1_42", "revoked"),
      orgMember("2_42", "valid"),
    ]);
    const tokenCheck = vi.fn((token: string) =>
      token === "revoked"
        ? Promise.reject(slackError("token_revoked"))
        : Promise.resolve(),
    );

    await createSlackUserTokensCheck(mongoStores, tokenCheck)(42);

    expect(tokenCheck).toHaveBeenCalledTimes(2);
    expect(partialUpdateMany).toHaveBeenCalledTimes(1);
    expect(partialUpdateMany).toHaveBeenCalledWith(
      { _id: "1_42", "slack.accessToken": "revoked" },
      { $set: { "slack.tokenRevokedAt": expect.any(Date) } },
      { touchUpdated: false },
    );
  });

  it("clears the flag once slack accepts the token again", async () => {
    const { mongoStores, partialUpdateMany } = setup([
      orgMember("1_42", "token", new Date()),
    ]);

    await createSlackUserTokensCheck(mongoStores, () => Promise.resolve())(42);

    expect(partialUpdateMany).toHaveBeenCalledWith(
      { _id: "1_42", "slack.accessToken": "token" },
      { $unset: { "slack.tokenRevokedAt": true } },
      { touchUpdated: false },
    );
  });

  it("writes nothing when the flag already matches slack", async () => {
    const { mongoStores, partialUpdateMany } = setup([
      orgMember("1_42", "revoked", new Date()),
      orgMember("2_42", "valid"),
    ]);

    await createSlackUserTokensCheck(mongoStores, (token) =>
      token === "revoked"
        ? Promise.reject(slackError("token_revoked"))
        : Promise.resolve(),
    )(42);

    expect(partialUpdateMany).not.toHaveBeenCalled();
  });

  it.each(["invalid_auth", "account_inactive", "token_expired"])(
    "treats %s as revoked",
    async (error) => {
      const { mongoStores, partialUpdateMany } = setup([
        orgMember("1_42", "token"),
      ]);

      await createSlackUserTokensCheck(mongoStores, () =>
        Promise.reject(slackError(error)),
      )(42);

      expect(partialUpdateMany).toHaveBeenCalledTimes(1);
    },
  );

  it("keeps the membership as is on any other failure", async () => {
    const { mongoStores, partialUpdateMany } = setup([
      orgMember("1_42", "token"),
      orgMember("2_42", "flagged", new Date()),
    ]);

    await createSlackUserTokensCheck(mongoStores, () =>
      Promise.reject(new Error("ECONNRESET")),
    )(42);
    await createSlackUserTokensCheck(mongoStores, () =>
      Promise.reject(slackError("ratelimited")),
    )(42);

    expect(partialUpdateMany).not.toHaveBeenCalled();
  });
});
