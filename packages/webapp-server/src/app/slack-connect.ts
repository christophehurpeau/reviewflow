import { WebClient } from "@slack/web-api";
import type { Request, Response, Router } from "express";
import type { MongoInsertType } from "liwi-mongo";
import type { MongoStores, SlackTeam } from "reviewflow-core";
import type { SetRequired } from "type-fest";
import { slackOAuth2, slackOAuth2Version2 } from "../auth/slack.ts";
import { callBotApiBestEffort } from "../botApi.ts";
import { webappUrl } from "../webappUrl.ts";
import { getUser } from "./auth.ts";

if (!process.env.AUTH_SECRET_KEY) {
  throw new Error("Missing env variable: AUTH_SECRET_KEY");
}

const createRedirectUri = (req: Request): string => {
  const host = `https://${req.hostname}${
    req.hostname === "localhost" ? `:${process.env.PORT || 3000}` : ""
  }`;
  return `${host}/app/slack-connect-response`;
};

const orgErrorUrl = (orgLogin: string | undefined, error: string): string =>
  webappUrl(orgLogin ? `/org/${orgLogin}` : "/", { error });

const parseJSONSafe = (string: string) => {
  try {
    return JSON.parse(string);
  } catch {
    return null;
  }
};

/**
 * Both the org id and the oauth state are attacker controlled: without this,
 * any logged in user could point another org's slack workspace, or their own
 * slack identity, at an org they have nothing to do with.
 */
const isOrgMember = async (
  mongoStores: MongoStores,
  orgId: number,
  userId: number,
): Promise<boolean> =>
  !!(await mongoStores.orgMembers.findOne({
    "org.id": orgId,
    "user.id": userId,
  }));

const notAMemberUrl = (): string =>
  webappUrl("/", { error: "You are not a member of this organization." });

export default function slackConnect(
  router: Router,
  mongoStores: MongoStores,
): void {
  const slackConnectUserScope = "identity.basic identity.email identity.avatar";

  router.get("/slack-connect", async (req: Request, res: Response, next) => {
    try {
      const user = await getUser(req, res);
      if (!user) return;

      const orgId = Number(req.query.orgId);
      const orgLogin = req.query.orgLogin as string;
      if (!orgId || !orgLogin) {
        res.redirect(webappUrl("/"));
        return;
      }

      if (!(await isOrgMember(mongoStores, orgId, user.authInfo.id))) {
        res.redirect(notAMemberUrl());
        return;
      }

      const org = await mongoStores.orgs.findByKey(orgId);

      if (!org?.slackTeamId) {
        res.redirect(
          webappUrl("/", { error: "Organization is not installed." }),
        );
        return;
      }

      const redirectUri = slackOAuth2.authorizeURL({
        redirect_uri: createRedirectUri(req),
        scope: slackConnectUserScope,
        state: JSON.stringify({ orgId, orgLogin }),
        team: org.slackTeamId,
      } as any);

      res.redirect(redirectUri);
    } catch (error) {
      next(error);
    }
  });

  // see url in https://app.slack.com/app-settings/T01495JH7RS/A023QGDUDQX/distribute for scopes
  const slackInstallAppScopes =
    "chat:write,im:history,im:read,im:write,mpim:history,mpim:read,mpim:write,reactions:read,reactions:write,team:read,users:read,users:read.email,users:write";

  router.get("/slack-install", async (req: Request, res: Response, next) => {
    try {
      const user = await getUser(req, res);
      if (!user) return;

      const orgId = Number(req.query.orgId);
      const orgLogin = req.query.orgLogin as string;
      if (!orgId || !orgLogin) {
        res.redirect(webappUrl("/"));
        return;
      }

      if (!(await isOrgMember(mongoStores, orgId, user.authInfo.id))) {
        res.redirect(notAMemberUrl());
        return;
      }

      const redirectUri = slackOAuth2Version2.authorizeURL({
        redirect_uri: createRedirectUri(req),
        scope: slackInstallAppScopes,
        state: JSON.stringify({ orgId, orgLogin, isInstall: true }),
      });

      res.redirect(redirectUri);
    } catch (error) {
      next(error);
    }
  });

  router.get("/slack-connect-response", async (req, res, next) => {
    try {
      const user = await getUser(req, res);
      if (!user) return;

      if (req.query.error) {
        res.redirect(
          webappUrl("/", {
            error:
              typeof req.query.error_description === "string"
                ? req.query.error_description
                : "Could not get slack access token",
          }),
        );

        return;
      }

      const code: string = req.query.code as string;
      const state: string = req.query.state as string;
      const {
        orgId: stateOrgId,
        orgLogin,
        isInstall,
      } = parseJSONSafe(state) || {};
      const orgId = Number(stateOrgId);

      if (
        !orgId ||
        !(await isOrgMember(mongoStores, orgId, user.authInfo.id))
      ) {
        res.redirect(notAMemberUrl());
        return;
      }

      const accessToken = await (
        isInstall ? slackOAuth2Version2 : slackOAuth2
      ).getToken({
        code,
        redirect_uri: createRedirectUri(req),
        scope: isInstall ? slackInstallAppScopes : undefined,
      });

      if (!accessToken.token.ok) {
        res.redirect(
          orgErrorUrl(
            orgLogin,
            `Could not get access token (${(accessToken.token as any)?.error || "Unknown"})`,
          ),
        );
        return;
      }

      const org = await mongoStores.orgs.findByKey(orgId);

      if (!org) {
        res.redirect(orgErrorUrl(orgLogin, "Organization is not installed."));
        return;
      }

      // install slack, not login
      if (isInstall) {
        if (!(accessToken.token.team as any)?.id) {
          res.redirect(orgErrorUrl(orgLogin, "Invalid token: no team id."));
          return;
        }

        const slackTeam: SetRequired<MongoInsertType<SlackTeam>, "_id"> = {
          _id: (accessToken.token.team as any).id as string,
          teamName: (accessToken.token.team as any).name as string,
          appId: accessToken.token.app_id as string,
          installerUserId: (accessToken.token.authed_user as any).id as string,
          botUserId: accessToken.token.bot_user_id as string,
          botAccessToken: accessToken.token.access_token as string,
          scope: accessToken.token.scope
            ? (accessToken.token.scope as string).split(",")
            : [],
        };

        await Promise.all([
          mongoStores.slackTeams.insertOne(slackTeam),
          mongoStores.slackTeamInstallations.insertOne({
            ...slackTeam,
            teamId: slackTeam._id,
            _id: undefined,
          }),
          mongoStores.orgs.partialUpdateOne(org, {
            $set: {
              slackTeamId: slackTeam._id,
            },
          }),
        ]);

        await callBotApiBestEffort("/slack/org-installed", { orgId, orgLogin });

        res.redirect(webappUrl(orgLogin ? `/org/${orgLogin}` : "/"));
        return;
      }

      const slackClient = new WebClient(
        accessToken.token.access_token as string,
      );
      const identity = await slackClient.users.identity({});

      if (!org.slackTeamId && !org.slackToken) {
        res.redirect(
          orgErrorUrl(
            orgLogin,
            "Organization is not linked to slack. Install it first.",
          ),
        );
        return;
      }

      if (org.slackTeamId && accessToken.token.team_id !== org.slackTeamId) {
        res.redirect(orgErrorUrl(org.login, "Invalid slack team."));
        return;
      }

      await mongoStores.orgMembers.partialUpdateMany(
        { "user.id": user.authInfo.id, "org.id": orgId },
        {
          $set: {
            slack: {
              id: accessToken.token.user_id as string,
              accessToken: accessToken.token.access_token as string,
              scope: accessToken.token.scope
                ? (accessToken.token.scope as string).split(",")
                : [],
              teamId: accessToken.token.team_id as string,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              email: (identity as any).user.email,
            },
          },
        },
      );

      await callBotApiBestEffort("/slack/member-linked", {
        orgId,
        orgLogin,
        userId: user.authInfo.id,
        userLogin: user.authInfo.login,
      });

      res.redirect(webappUrl(orgLogin ? `/org/${orgLogin}` : "/"));
    } catch (error) {
      next(error);
    }
  });
}
