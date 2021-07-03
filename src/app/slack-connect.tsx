import { WebClient } from '@slack/web-api';
import type { Router, Request, Response } from 'express';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { slackOAuth2 } from '../auth/slack';
import { getExistingAccountContext } from '../context/accountContext';
import type { MongoStores } from '../mongo';
import Layout from '../views/Layout';
import { getUser } from './auth';

if (!process.env.AUTH_SECRET_KEY) {
  throw new Error('Missing env variable: AUTH_SECRET_KEY');
}

const createRedirectUri = (req: Request): string => {
  const host = `https://${req.hostname}${
    req.hostname === 'localhost' ? `:${process.env.PORT || 3000}` : ''
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
  router.get(
    '/slack-connect',
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    async (req: Request, res: Response, next) => {
      try {
        const user = await getUser(req, res);
        if (!user) return;

        const orgId = Number(req.query.orgId);
        const orgLogin = req.query.orgLogin as string;
        if (!orgId || !orgLogin) {
          res.redirect('/app');
          return;
        }

        const org = await mongoStores.orgs.findByKey(orgId);

        if (!org) {
          res.send(
            renderToStaticMarkup(
              <Layout>Organization is not installed.</Layout>,
            ),
          );
          return;
        }

        const redirectUri = slackOAuth2.authorizeURL({
          redirect_uri: createRedirectUri(req),
          scope: 'identity.basic identity.email identity.avatar',
          state: JSON.stringify({ orgId, orgLogin }),
        });

        // TODO team_id
        res.redirect(redirectUri);
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/slack-install',
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    async (req: Request, res: Response, next) => {
      try {
        const user = await getUser(req, res);
        if (!user) return;

        const orgId = Number(req.query.orgId);
        const orgLogin = req.query.orgLogin as string;
        if (!orgId || !orgLogin) {
          res.redirect('/app');
          return;
        }

        const redirectUri = slackOAuth2.authorizeURL({
          redirect_uri: createRedirectUri(req),
          // see url in https://app.slack.com/app-settings/T01495JH7RS/A023QGDUDQX/distribute for scopes
          //=chat:write,im:history,im:read,mpim:read,im:write,mpim:history,mpim:write,reactions:read,reactions:write,team:read,users:read,users:read.email,users:write&user_scope=
          scope:
            'chat:write im:history im:read im:write mpim:history mpim:read mpim:write reactions:read reactions:write team:read users:read users:read.email users:write',
          state: JSON.stringify({ orgId, orgLogin, isInstall: true }),
        });

        res.redirect(redirectUri);
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/slack-connect-response',
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    async (req, res, next) => {
      try {
        const user = await getUser(req, res);
        if (!user) return;

        if (req.query.error) {
          res.send(
            renderToStaticMarkup(
              <Layout>
                Could not get access token:{' '}
                {req.query.error_description || req.query.error}.
              </Layout>,
            ),
          );

          return;
        }

        const code: string = req.query.code as string;
        const state: string = req.query.state as string;
        const { orgId, orgLogin, isInstall } = parseJSONSafe(state) || {};

        const accessToken = await slackOAuth2.getToken({
          code,
          redirect_uri: createRedirectUri(req),
        });

        if (!accessToken || !accessToken.token.ok) {
          res.send(
            renderToStaticMarkup(<Layout>Could not get access token.</Layout>),
          );
          return;
        }

        const org = await mongoStores.orgs.findByKey(orgId);

        if (!org) {
          res.send(
            renderToStaticMarkup(
              <Layout>Organization is not installed.</Layout>,
            ),
          );
          return;
        }

        // install slack, not login
        if (isInstall) {
          await mongoStores.orgs.partialUpdateOne(org, {
            $set: {
              slack: {
                id: accessToken.token.user_id,
                accessToken: accessToken.token.access_token,
                scope: accessToken.token.scope
                  ? accessToken.token.scope.split(',')
                  : [],
                teamId: accessToken.token.team_id,
              },
            },
          });

          const existingAccountContext = await getExistingAccountContext({
            type: 'Organization',
            id: orgId,
            login: orgLogin,
          });

          if (existingAccountContext) {
            existingAccountContext.initSlack();
          }

          res.redirect(`/app/org/${orgLogin || ''}`);
          return;
        }

        const slackClient = new WebClient(accessToken.token.access_token);
        const identity = await slackClient.users.identity();

        if (!org.slack && !org.slackToken) {
          res.send(
            renderToStaticMarkup(
              <Layout>
                Organization is not linked to slack. Install it first.
              </Layout>,
            ),
          );
          return;
        }

        if (
          org?.slack?.teamId &&
          accessToken.token.team_id !== org?.slack?.teamId
        ) {
          res.send(
            renderToStaticMarkup(
              <Layout>
                Invalid slack team.{' '}
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
          { 'user.id': user.authInfo.id, 'org.id': orgId },
          {
            $set: {
              slack: {
                id: accessToken.token.user_id,
                accessToken: accessToken.token.access_token,
                scope: accessToken.token.scope
                  ? accessToken.token.scope.split(',')
                  : [],
                teamId: accessToken.token.team_id,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                email: (identity as any).user.email,
              },
            },
          },
        );

        const existingAccountContext = await getExistingAccountContext({
          type: 'Organization',
          id: orgId,
          login: orgLogin,
        });

        if (existingAccountContext) {
          existingAccountContext.slack.updateSlackMember(
            user.authInfo.id,
            user.authInfo.login,
          );
        }

        res.redirect(`/app/org/${orgLogin || ''}`);
      } catch (err) {
        next(err);
      }
    },
  );
}
