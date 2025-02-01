import { WebClient } from "@slack/web-api";
import type { Request, Response, Router } from "express";
import type { MongoInsertType } from "liwi-mongo";
import { renderToStaticMarkup } from "react-dom/server";
import type { SetRequired } from "type-fest";
import { slackOAuth2, slackOAuth2Version2 } from "../auth/slack";
import { getExistingAccountContext } from "../context/accountContext";
import type { MongoStores, SlackTeam } from "../mongo";
import Layout from "../views/Layout.tsx";
import { getUser } from "./auth.tsx";

if (!process.env.AUTH_SECRET_KEY) {
  throw new Error("Missing env variable: AUTH_SECRET_KEY");
}

const createRedirectUri = (req: Request): string => {
  const host = `https://${req.hostname}${
    req.hostname === "localhost" ? `:${process.env.PORT || 3000}` : ""
  }`;
  return `${host}/app/slack-connect-response`;
};

const parseJSONSafe = (string: string) => {
  try {
    return JSON.parse(string);
  } catch {
    return null;
  }
};

export default function slackConnect(
  router: Router,
  mongoStores: MongoStores,
): void {
  const slackConnectUserScope = "identity.basic identity.email identity.avatar";

  router.get(
    "/slack-connect",
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    async (req: Request, res: Response, next) => {
      try {
        const user = await getUser(req, res);
        if (!user) return;

        const orgId = Number(req.query.orgId);
        const orgLogin = req.query.orgLogin as string;
        if (!orgId || !orgLogin) {
          res.redirect("/app");
          return;
        }

        const org = await mongoStores.orgs.findByKey(orgId);

        if (!org?.slackTeamId) {
          res.send(
            renderToStaticMarkup(
              <Layout>Organization is not installed.</Layout>,
            ),
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
    },
  );

  // see url in https://app.slack.com/app-settings/T01495JH7RS/A023QGDUDQX/distribute for scopes
  const slackInstallAppScopes =
    "chat:write,im:history,im:read,im:write,mpim:history,mpim:read,mpim:write,reactions:read,reactions:write,team:read,users:read,users:read.email,users:write";

  router.get(
    "/slack-install",
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    async (req: Request, res: Response, next) => {
      try {
        const user = await getUser(req, res);
        if (!user) return;

        const orgId = Number(req.query.orgId);
        const orgLogin = req.query.orgLogin as string;
        if (!orgId || !orgLogin) {
          res.redirect("/app");
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
    },
  );

  router.get(
    "/slack-connect-response",
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    async (req, res, next) => {
      try {
        const user = await getUser(req, res);
        if (!user) return;

        if (req.query.error) {
          res.send(
            renderToStaticMarkup(
              <Layout>
                Could not get access token:{" "}
                {
                  // eslint-disable-next-line @typescript-eslint/no-base-to-string
                  String(req.query.error_description || req.query.error)
                }
                .
              </Layout>,
            ),
          );

          return;
        }

        const code: string = req.query.code as string;
        const state: string = req.query.state as string;
        const { orgId, orgLogin, isInstall } = parseJSONSafe(state) || {};

        const accessToken = await (
          isInstall ? slackOAuth2Version2 : slackOAuth2
        ).getToken({
          code,
          redirect_uri: createRedirectUri(req),
          scope: isInstall ? slackInstallAppScopes : undefined,
        });

        if (!accessToken.token.ok) {
          res.send(
            renderToStaticMarkup(
              <Layout>
                Could not get access token (Error:{" "}
                {(accessToken.token as any)?.error || "Unknown"}).
                <div>
                  <a href={`/app/org/${orgLogin || ""}`}>Back</a>
                </div>
              </Layout>,
            ),
          );
          return;
        }

        const org = await mongoStores.orgs.findByKey(orgId);

        if (!org) {
          res.send(
            renderToStaticMarkup(
              <Layout>
                Organization is not installed.
                <div>
                  <a href={`/app/org/${orgLogin || ""}`}>Back</a>
                </div>
              </Layout>,
            ),
          );
          return;
        }

        // install slack, not login
        if (isInstall) {
          if (!(accessToken.token.team as any)?.id) {
            res.send(
              renderToStaticMarkup(
                <Layout>
                  Invalid token: no team id.
                  <div>
                    <a href={`/app/org/${orgLogin || ""}`}>Back</a>
                  </div>
                </Layout>,
              ),
            );
            return;
          }

          const slackTeam: SetRequired<MongoInsertType<SlackTeam>, "_id"> = {
            _id: (accessToken.token.team as any).id as string,
            teamName: (accessToken.token.team as any).name as string,
            appId: accessToken.token.app_id as string,
            installerUserId: (accessToken.token.authed_user as any)
              .id as string,
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

          const existingAccountContext = await getExistingAccountContext({
            type: "Organization",
            id: orgId,
            login: orgLogin,
          });

          if (existingAccountContext) {
            existingAccountContext.initSlack();
          }

          res.redirect(`/app/org/${orgLogin || ""}`);
          return;
        }

        const slackClient = new WebClient(
          accessToken.token.access_token as string,
        );
        const identity = await slackClient.users.identity();

        if (!org.slackTeamId && !org.slackToken) {
          res.send(
            renderToStaticMarkup(
              <Layout>
                Organization is not linked to slack. Install it first.
                <div>
                  <a href={`/app/org/${orgLogin || ""}`}>Back</a>
                </div>
              </Layout>,
            ),
          );
          return;
        }

        if (org.slackTeamId && accessToken.token.team_id !== org.slackTeamId) {
          res.send(
            renderToStaticMarkup(
              <Layout>
                Invalid slack team.{" "}
                <a
                  href={`/app/slack-connect?orgId=${encodeURIComponent(
                    org._id,
                  )}&orgLogin=${encodeURIComponent(org.login)}`}
                >
                  Retry ?
                </a>
              </Layout>,
            ),
          );
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

        const existingAccountContext = await getExistingAccountContext({
          type: "Organization",
          id: orgId,
          login: orgLogin,
        });

        if (existingAccountContext) {
          existingAccountContext.slack.updateSlackMember(
            user.authInfo.id,
            user.authInfo.login,
          );
        }

        res.redirect(`/app/org/${orgLogin || ""}`);
      } catch (error) {
        next(error);
      }
    },
  );
}
