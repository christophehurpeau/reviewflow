import { promisify } from 'util';
import { Octokit } from 'probot';
import type { Router, Request, Response } from 'express';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { sign, verify } from 'jsonwebtoken';
import * as githubAuth from '../auth/github';
import Layout from '../views/Layout';

if (!process.env.AUTH_SECRET_KEY) {
  throw new Error('Missing env variable: AUTH_SECRET_KEY');
}

const AUTH_SECRET_KEY: string = process.env.AUTH_SECRET_KEY;

const signPromisified: any = promisify(sign);
const verifyPromisified: any = promisify(verify);

const secure =
  !!process.env.SECURE_COOKIE && process.env.SECURE_COOKIE !== 'false';

const createRedirectUri = (req: Request, strategy: string): string => {
  const host = `http${secure ? 's' : ''}://${req.hostname}${
    req.hostname === 'localhost' ? `:${process.env.PORT}` : ''
  }`;
  return `${host}/app/${strategy}/login-response`;
};

interface AuthInfo {
  id: number;
  login: string;
  accessToken: string;
  time: number;
}

const readAuthCookie = (
  req: Request,
  strategy: string,
): undefined | Promise<undefined | AuthInfo> => {
  const cookie = req.cookies[`auth_${strategy}`];
  if (!cookie) return;

  return verifyPromisified(cookie, AUTH_SECRET_KEY, {
    algorithm: 'HS512',
    audience: req.headers['user-agent'],
  });
};

const getAuthInfoFromCookie = async (
  req: Request,
  res: Response,
): Promise<undefined | AuthInfo> => {
  const strategy = 'gh'; // req.params.strategy
  const authInfo = await readAuthCookie(req, strategy);

  if (authInfo?.id) {
    return authInfo;
  }

  res.clearCookie(`auth_${strategy}`);
  return undefined;
};

export const getUser = async (
  req: Request,
  res: Response,
): Promise<{ authInfo: AuthInfo; api: Octokit } | null> => {
  const authInfo = await getAuthInfoFromCookie(req, res);
  if (!authInfo) {
    res.redirect('/app/gh/login');
    return null;
  }

  return {
    authInfo,
    api: new Octokit({ auth: `token ${authInfo.accessToken}` }),
  };
};

export default function auth(router: Router): void {
  router.get('/gh/login', async (req: Request, res: Response) => {
    if (await getAuthInfoFromCookie(req, res)) {
      return res.redirect('/app/gh');
    }

    // const state = await randomHex(8);
    // res.cookie(`auth_${strategy}_${state}`, strategy, {
    //   maxAge: 10 * 60 * 1000,
    //   httpOnly: true,
    //   secure,
    // });

    const redirectUri = githubAuth.oauth2.authorizationCode.authorizeURL({
      redirect_uri: createRedirectUri(req, 'gh'),
      scope: 'read:user,repo',
      // state,
      // grant_type: options.grantType,
      // access_type: options.accessType,
      // login_hint: req.query.loginHint,
      // include_granted_scopes: options.includeGrantedScopes,
    });

    // console.log(redirectUri);

    res.redirect(redirectUri);
  });

  router.get('/gh/login-response', async (req, res) => {
    if (req.query.error) {
      res.send(req.query.error_description);
      return;
    }

    const strategy = 'gh';
    const code: string = req.query.code as string;
    // const state = req.query.state;
    // const cookieName = `auth_${strategy}_${state}`;
    // const cookie = req.cookies && req.cookies[cookieName];
    // if (!cookie) {
    //   // res.redirect(`/${strategy}/login`);
    //   res.send(
    //     '<html><body>No cookie for this state. <a href="/app/gh/login">Retry ?</a></body></html>',
    //   );
    //   return;
    // }
    // res.clearCookie(cookieName);

    const result = await githubAuth.oauth2.authorizationCode.getToken({
      code,
      redirect_uri: createRedirectUri(req, strategy),
    });

    if (!result) {
      res.send(
        renderToStaticMarkup(
          <Layout>
            <div>
              Could not get access token. <a href="/app/gh/login">Retry ?</a>
            </div>
          </Layout>,
        ),
      );
      return;
    }

    const accessToken = result.access_token;
    const octokit = new Octokit({ auth: `token ${accessToken}` });
    const user = await octokit.users.getAuthenticated({});
    const id = user.data.id;
    const login = user.data.login;

    const authInfo: AuthInfo = { id, login, accessToken, time: Date.now() };
    const token = await signPromisified(authInfo, AUTH_SECRET_KEY, {
      algorithm: 'HS512',
      audience: req.headers['user-agent'],
      expiresIn: '10 days',
    });

    res.cookie(`auth_${strategy}`, token, {
      httpOnly: true,
      secure,
    });

    res.redirect('/app/gh');
  });
}
