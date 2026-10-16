import { WebClient } from "@slack/web-api";
import type { MongoStores, OrgMember } from "reviewflow-core";

export type SlackTokenCheck = (token: string) => Promise<void>;

/**
 * `users.identity` and not `auth.test`: the sign-in grants only `identity.*`
 * scopes, and such a token is accepted by `users.identity` alone.
 */
const slackIdentityCheck: SlackTokenCheck = async (token) => {
  await new WebClient(token, {
    retryConfig: { retries: 0 },
    rejectRateLimitedCalls: true,
  }).users.identity({});
};

const revokedTokenErrors = new Set([
  "account_inactive",
  "invalid_auth",
  "token_expired",
  "token_revoked",
]);

const getSlackErrorCode = (error: unknown): string | undefined =>
  (error as { data?: { error?: string } } | undefined)?.data?.error;

const isTokenRefused = async (
  tokenCheck: SlackTokenCheck,
  token: string,
): Promise<boolean | undefined> => {
  try {
    await tokenCheck(token);
    return false;
  } catch (error: unknown) {
    const code = getSlackErrorCode(error);
    return code && revokedTokenErrors.has(code) ? true : undefined;
  }
};

const checkOrgMemberToken = async (
  mongoStores: MongoStores,
  tokenCheck: SlackTokenCheck,
  orgMember: OrgMember,
): Promise<void> => {
  const token = orgMember.slack?.accessToken;
  if (!token) return;

  const refused = await isTokenRefused(tokenCheck, token);
  const isFlagged = !!orgMember.slack?.tokenRevokedAt;
  if (refused === undefined || refused === isFlagged) return;

  // matching the token: a sign-in since the check stored a new one
  await mongoStores.orgMembers.partialUpdateMany(
    { _id: orgMember._id, "slack.accessToken": token },
    refused
      ? { $set: { "slack.tokenRevokedAt": new Date() } }
      : { $unset: { "slack.tokenRevokedAt": true } },
    { touchUpdated: false },
  );
};

/**
 * Keeps `slack.tokenRevokedAt` in step with slack on each of the user's
 * memberships: set when slack refuses the user token, cleared when it accepts
 * it. Any other failure (network, rate limit) leaves the membership as is.
 */
export const createSlackUserTokensCheck =
  (
    mongoStores: MongoStores,
    tokenCheck: SlackTokenCheck = slackIdentityCheck,
  ): ((userId: number) => Promise<void>) =>
  async (userId) => {
    const orgMembers = await mongoStores.orgMembers.findAll({
      "user.id": userId,
      "slack.accessToken": { $exists: true },
    });
    await Promise.all(
      orgMembers.map((orgMember) =>
        checkOrgMemberToken(mongoStores, tokenCheck, orgMember),
      ),
    );
  };
