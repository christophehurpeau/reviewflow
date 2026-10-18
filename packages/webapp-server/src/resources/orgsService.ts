import { ResourcesServerError } from "liwi-resources-server";
import type { ServiceResource } from "liwi-resources-server";
import {
  accountConfigs,
  defaultConfig,
  defaultDmSettings,
  getTeams,
  isPaidEnabled,
} from "reviewflow-core";
import type { MongoStores, Org, OrgMember } from "reviewflow-core";
import { paidFeaturesContactEmail } from "reviewflow-modules";
import type {
  OrgPersonalTokensPolicy,
  OrgSettings,
  OrgSlackStatus,
  OrgSummary,
  OrgsService,
  UserDmSettingsSummary,
} from "reviewflow-modules";
import type { ResourcesContext } from "../ResourcesContext.ts";
import { callBotApi } from "../botApi.ts";
import { setDmSetting, setTeamSilenced } from "../dm/updateUserDmSettings.ts";
import { orgAllowsPersonalTokens } from "../orgAllowsPersonalTokens.ts";
import type { AuthenticatedWsUser } from "./getAuthenticatedUser.ts";
import type { MembershipScopes } from "./membershipScopes.ts";
import {
  isOrgOwner,
  requireAuthenticatedUser,
  requireOrgMember,
  requireOrgOwner,
} from "./requireAuth.ts";
import {
  createScopedQuery,
  matchNothing,
  toScopeOrUndefined,
} from "./scopedQuery.ts";

const buildSlackStatus = (
  org: Org,
  orgMember: OrgMember,
  slackTeamName: string | undefined,
): OrgSlackStatus => {
  const usesDeprecatedCustomApp = !!org.slackToken;

  if (!org.slackTeamId && !usesDeprecatedCustomApp) {
    return { state: "app-not-installed", usesDeprecatedCustomApp };
  }

  if (!orgMember.slack) {
    return {
      state: "user-not-linked",
      teamName: slackTeamName,
      teamId: org.slackTeamId,
      usesDeprecatedCustomApp,
    };
  }

  return {
    state: orgMember.slack.tokenRevokedAt ? "token-revoked" : "linked",
    teamName: slackTeamName,
    teamId: orgMember.slack.teamId || org.slackTeamId,
    userId: orgMember.slack.id,
    usesDeprecatedCustomApp,
  };
};

const requireOrg = async (
  mongoStores: MongoStores,
  orgId: number,
): Promise<Org> => {
  const org = await mongoStores.orgs.findByKey(orgId);
  if (!org) {
    throw new ResourcesServerError("NOT_FOUND", "Unknown organization");
  }
  return org;
};

export const createOrgsService = (
  { mongoStores }: ResourcesContext,
  scopes: MembershipScopes,
): ServiceResource<OrgsService, AuthenticatedWsUser> => ({
  queries: {
    queryMyOrgs: async (params, loggedInUser) => {
      const user = requireAuthenticatedUser(loggedInUser);
      const findOrgIds = async (): Promise<number[]> => {
        const orgMembers = await mongoStores.orgMembers.findAll({
          "user.id": user.id,
        });
        return orgMembers.map(({ org }) => org.id).toSorted((a, b) => a - b);
      };

      return createScopedQuery({
        user,
        scopes,
        initialScope: await findOrgIds(),
        resolveScope: findOrgIds,
        createQuery: (orgIds) =>
          mongoStores.orgs.createQueryCollection({
            criteria: { _id: { $in: orgIds ?? [] } },
            sort: { login: 1 },
            transformer: (org): OrgSummary => ({
              _id: org._id,
              login: org.login,
              status: org.status,
              allowPersonalTokens: orgAllowsPersonalTokens(org),
              paidEnabled: isPaidEnabled(org),
            }),
          }),
      });
    },

    queryOrgPersonalTokensPolicy: async ({ orgId }, loggedInUser) => {
      const { user } = await requireOrgMember(mongoStores, orgId, loggedInUser);
      const viewerIsOwner = await isOrgOwner(orgId, user);

      return createScopedQuery({
        user,
        scopes,
        initialScope: true,
        resolveScope: () =>
          toScopeOrUndefined(async () => {
            await requireOrgMember(mongoStores, orgId, user);
            return true;
          }),
        createQuery: (isMember) =>
          mongoStores.orgs.createQuerySingleItem({
            criteria: isMember ? { _id: orgId } : matchNothing,
            transformer: (org): OrgPersonalTokensPolicy => ({
              _id: org._id,
              allowPersonalTokens: orgAllowsPersonalTokens(org),
              paidEnabled: isPaidEnabled(org),
              viewerIsOwner,
            }),
          }),
      });
    },

    queryOrgSettings: async ({ orgLogin }, loggedInUser) => {
      const user = requireAuthenticatedUser(loggedInUser);
      const org = await mongoStores.orgs.findOne({ login: orgLogin });
      if (!org) {
        throw new ResourcesServerError("NOT_FOUND", "Unknown organization");
      }
      await requireOrgMember(mongoStores, org._id, user);

      const accountConfig = accountConfigs[org.login];
      const slackTeam = org.slackTeamId
        ? await mongoStores.slackTeams.findByKey(org.slackTeamId)
        : undefined;

      return mongoStores.orgMembers.createQuerySingleItem({
        criteria: { "org.id": org._id, "user.id": user.id },
        transformer: (orgMember): OrgSettings => ({
          _id: orgMember._id,
          orgId: org._id,
          login: org.login,
          hasCustomAccountConfig: !!accountConfig,
          slack: buildSlackStatus(org, orgMember, slackTeam?.teamName),
          configTeamNames: getTeams(accountConfig || defaultConfig, orgMember),
          githubTeams: orgMember.teams.map(({ id, name, slug }) => ({
            id,
            name,
            slug,
          })),
          defaultDmSettings: accountConfig?.defaultDmSettings
            ? { ...defaultDmSettings, ...accountConfig.defaultDmSettings }
            : defaultDmSettings,
        }),
      });
    },

    queryMyDmSettings: async ({ orgId }, loggedInUser) => {
      const { user } = await requireOrgMember(mongoStores, orgId, loggedInUser);

      return createScopedQuery({
        user,
        scopes,
        initialScope: true,
        resolveScope: () =>
          toScopeOrUndefined(async () => {
            await requireOrgMember(mongoStores, orgId, user);
            return true;
          }),
        createQuery: (isMember) =>
          mongoStores.userDmSettings.createQuerySingleItem({
            criteria: isMember ? { orgId, userId: user.id } : matchNothing,
            transformer: ({
              _id,
              settings,
              silentTeams,
            }): UserDmSettingsSummary => ({
              _id,
              settings,
              silentTeamIds: silentTeams?.map((team) => team.id) ?? [],
            }),
          }),
      });
    },
  },

  operations: {
    setDmSetting: async ({ orgId, key, value }, loggedInUser) => {
      const { user } = await requireOrgMember(mongoStores, orgId, loggedInUser);

      await setDmSetting(mongoStores, { orgId, userId: user.id }, key, value);
    },

    setTeamSilenced: async ({ orgId, teamId, silenced }, loggedInUser) => {
      const { user, orgMember } = await requireOrgMember(
        mongoStores,
        orgId,
        loggedInUser,
      );
      const team = orgMember.teams.find(({ id }) => id === teamId);
      if (!team) {
        throw new ResourcesServerError(
          "NOT_FOUND",
          "You do not belong to this team",
        );
      }

      await setTeamSilenced(
        mongoStores,
        { orgId, userId: user.id },
        team,
        silenced,
      );
    },

    forceSync: async ({ orgId }, loggedInUser) => {
      await requireOrgMember(mongoStores, orgId, loggedInUser);
      const org = await requireOrg(mongoStores, orgId);

      await callBotApi("/sync/org", { orgId: org._id });
    },

    setAllowPersonalTokens: async ({ orgId, allow }, loggedInUser) => {
      const { user } = await requireOrgOwner(mongoStores, orgId, loggedInUser);
      if (allow && !isPaidEnabled(await requireOrg(mongoStores, orgId))) {
        throw new ResourcesServerError(
          "FORBIDDEN",
          `Personal tokens need the paid features, contact ${paidFeaturesContactEmail}`,
        );
      }

      await mongoStores.orgs.partialUpdateByKey(orgId, {
        $set: {
          "config.allowPersonalTokens": allow,
          "config.allowPersonalTokensChangedBy": {
            id: user.id,
            login: user.login,
            at: new Date(),
          },
        },
      });
    },
  },
});
