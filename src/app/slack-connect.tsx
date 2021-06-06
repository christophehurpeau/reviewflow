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
    async (req: Request, res: Response) => {
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
        scope: 'identity.basic identity.email identity.avatar',
        state: JSON.stringify({ orgId, orgLogin }),
      });

      res.redirect(redirectUri);
    },
  );

  router.get(
    '/slack-connect-response',
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    async (req, res) => {
      const user = await getUser(req, res);
      if (!user) return;

      if (req.query.error) {
        res.send(req.query.error_description);
        return;
      }

      const code: string = req.query.code as string;
      const state: string = req.query.state as string;
      const { orgId, orgLogin } = parseJSONSafe(state) || {};

      const accessToken = await slackOAuth2.getToken({
        code,
        redirect_uri: createRedirectUri(req),
      });

      if (!accessToken) {
        res.send(
          renderToStaticMarkup(
            <Layout>
              <div>Could not get access token.</div>
            </Layout>,
          ),
        );
        return;
      }

      // TODO ensure matches team_id in account

      const slackClient = new WebClient(accessToken.token.access_token);
      const identity = await slackClient.users.identity();

      await mongoStores.orgMembers.partialUpdateMany(
        { 'user.id': user.authInfo.id, 'org.id': orgId },
        {
          $set: {
            slack: {
              id: accessToken.token.user_id,
              accessToken: accessToken.token.access_token,
              scope: accessToken.token.scope,
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
    },
  );
}
