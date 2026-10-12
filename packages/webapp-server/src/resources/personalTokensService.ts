import { ResourcesServerError } from "liwi-resources-server";
import type { ServiceResource } from "liwi-resources-server";
import type { Criteria } from "liwi-store";
import { NotFoundError } from "liwi-store";
import type { MongoStores, PersonalToken } from "reviewflow-core";
import type {
  CreatedPersonalToken,
  PersonalTokenSummary,
  PersonalTokensService,
} from "reviewflow-modules";
import type { ResourcesContext } from "../ResourcesContext.ts";
import { generatePersonalToken } from "../auth/personalTokens.ts";
import type { AuthenticatedWsUser } from "./getAuthenticatedUser.ts";
import { requireAuthenticatedUser } from "./requireAuth.ts";

const maxNameLength = 100;
const maxActiveTokensPerUser = 20;

const activeTokensCriteria = (userId: number): Criteria<PersonalToken> => ({
  userId,
  revokedAt: { $exists: false },
});

const toPersonalTokenSummary = ({
  _id,
  name,
  prefix,
  created,
  lastUsedAt,
  lastUsedIp,
}: PersonalToken): PersonalTokenSummary => ({
  _id,
  name,
  prefix,
  createdAt: created,
  lastUsedAt,
  lastUsedIp,
});

const validateName = (name: string): string => {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new ResourcesServerError("BAD_REQUEST", "The name is required");
  }
  if (trimmed.length > maxNameLength) {
    throw new ResourcesServerError(
      "BAD_REQUEST",
      `The name is longer than ${maxNameLength} characters`,
    );
  }
  return trimmed;
};

const insertToken = async (
  mongoStores: MongoStores,
  user: AuthenticatedWsUser,
  name: string,
): Promise<CreatedPersonalToken> => {
  const { token, hash, prefix } = generatePersonalToken();
  const inserted = await mongoStores.personalTokens.insertOne({
    userId: user.id,
    // the webapp login does not record users: the api reads the login here
    userLogin: user.login,
    name,
    hash,
    prefix,
  });
  return { _id: inserted._id, token };
};

/**
 * Owner and "still active" are part of the update filter, so another user's
 * token answers exactly like an unknown one.
 */
const revokeOwnToken = async (
  mongoStores: MongoStores,
  userId: number,
  tokenId: string,
): Promise<PersonalToken> => {
  try {
    return await mongoStores.personalTokens.partialUpdateByKey(
      tokenId,
      { $set: { revokedAt: new Date() } },
      activeTokensCriteria(userId),
    );
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw new ResourcesServerError("NOT_FOUND", "Unknown token");
    }
    throw error;
  }
};

export const createPersonalTokensService = ({
  mongoStores,
}: ResourcesContext): ServiceResource<
  PersonalTokensService,
  AuthenticatedWsUser
> => ({
  queries: {
    queryMyPersonalTokens: (params, loggedInUser) => {
      const user = requireAuthenticatedUser(loggedInUser);
      return mongoStores.personalTokens.createQueryCollection({
        criteria: activeTokensCriteria(user.id),
        sort: { created: -1 },
        transformer: toPersonalTokenSummary,
      });
    },
  },
  operations: {
    createPersonalToken: async ({ name }, loggedInUser) => {
      const user = requireAuthenticatedUser(loggedInUser);
      const validName = validateName(name);

      const activeCount = await mongoStores.personalTokens.count(
        activeTokensCriteria(user.id),
      );
      if (activeCount >= maxActiveTokensPerUser) {
        throw new ResourcesServerError(
          "BAD_REQUEST",
          `You already have ${maxActiveTokensPerUser} tokens, revoke one first`,
        );
      }

      return insertToken(mongoStores, user, validName);
    },

    // revoked before the new one exists: a failure in between leaves the
    // user without a token, never with the old one still valid
    regeneratePersonalToken: async ({ tokenId }, loggedInUser) => {
      const user = requireAuthenticatedUser(loggedInUser);
      const revoked = await revokeOwnToken(mongoStores, user.id, tokenId);
      return insertToken(mongoStores, user, revoked.name);
    },

    revokePersonalToken: async ({ tokenId }, loggedInUser) => {
      const user = requireAuthenticatedUser(loggedInUser);
      await revokeOwnToken(mongoStores, user.id, tokenId);
    },
  },
});
