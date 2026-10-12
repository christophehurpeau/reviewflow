import { WebClient } from "@slack/web-api";
import type { MongoStores, OrgMember } from "reviewflow-core";

export type SlackAuthTest = (token: string) => Promise<void>;

const slackAuthTest: SlackAuthTest = async (token) => {
  await new WebClient(token, {
    retryConfig: { retries: 0 },
    rejectRateLimitedCalls: true,
  }).auth.test();
};

const revokedTokenErrors = new Set([
  "account_inactive",
  "invalid_auth",
  "token_expired",
  "token_revoked",
]);

const getSlackErrorCode = (error: unknown): string | undefined =>
  (error as { data?: { error?: string } } | undefined)?.data?.error;

const checkOrgMemberToken = async (
  mongoStores: MongoStores,
  authTest: SlackAuthTest,
  orgMember: OrgMember,
): Promise<void> => {
  const token = orgMember.slack?.accessToken;
  if (!token) return;

  try {
    await authTest(token);
  } catch (error: unknown) {
    const code = getSlackErrorCode(error);
    if (!code || !revokedTokenErrors.has(code)) return;

    // matching the token: a sign-in since the check stored a new one
    await mongoStores.orgMembers.partialUpdateMany(
      { _id: orgMember._id, "slack.accessToken": token },
      { $set: { "slack.tokenRevokedAt": new Date() } },
      { touchUpdated: false },
    );
  }
};

/**
 * Records `slack.tokenRevokedAt` on each of the user's memberships whose slack
 * user token slack refuses. Any other failure (network, rate limit) leaves the
 * token as valid.
 */
export const createSlackUserTokensCheck =
  (
    mongoStores: MongoStores,
    authTest: SlackAuthTest = slackAuthTest,
  ): ((userId: number) => Promise<void>) =>
  async (userId) => {
    const orgMembers = await mongoStores.orgMembers.findAll({
      "user.id": userId,
      "slack.accessToken": { $exists: true },
      "slack.tokenRevokedAt": { $exists: false },
    });
    await Promise.all(
      orgMembers.map((orgMember) =>
        checkOrgMemberToken(mongoStores, authTest, orgMember),
      ),
    );
  };
