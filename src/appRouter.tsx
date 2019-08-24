/* eslint-disable max-lines */

import { promisify } from 'util';
import Octokit from '@octokit/rest';
import { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import { sign, verify } from 'jsonwebtoken';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Application } from 'probot';
import { MongoStores } from './mongo';
import Layout from './views/Layout';
import * as githubAuth from './auth/github';
import { randomHex } from './utils/random';

if (!process.env.AUTH_SECRET_KEY) {
  throw new Error('Missing env variable: AUTH_SECRET_KEY');
}

const AUTH_SECRET_KEY: string = process.env.AUTH_SECRET_KEY;

const signPromisified: any = promisify(sign);
const verifyPromisified: any = promisify(verify);

const secure =
  !!process.env.SECURE_COOKIE && process.env.SECURE_COOKIE !== 'false';

const createRedirectUri = (req: Request, strategy: string) => {
  const host = `http${secure ? 's' : ''}://${req.hostname}${
    req.hostname === 'localhost' ? `:${process.env.PORT}` : ''
  }`;
  return `${host}/${strategy}/login-response`;
};

interface AuthInfo {
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

export default async function appRouter(
  app: Application,
  mongoStuff: MongoStores,
): Promise<void> {
  const router = app.route('/app');
  const api = await app.auth();
  router.use(cookieParser());

  router.get('/', (req, res) => {
    res.redirect('/gh');
  });

  router.get('/gh', async (req, res) => {
    const strategy = 'gh';
    const authInfo = await readAuthCookie(req, strategy);
    if (!authInfo) {
      return res.redirect('/gh/login');
    }

    const octokit = new Octokit({ auth: `token ${authInfo.accessToken}` });
    const { data } = await octokit.repos.list({ per_page: 100 });

    res.send(
      renderToStaticMarkup(
        <Layout>
          <div>
            <h4>Your repositories</h4>
            <ul>
              {data.map((repo: any) => (
                <li key={repo.id}>
                  <a href={`/gh/repository/${repo.owner.login}/${repo.name}`}>
                    {repo.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          {data.length === 100 && (
            <div>We currently have a limit to 100 repositories</div>
          )}
        </Layout>,
      ),
    );
  });

  router.get('/gh/login', async (req: Request, res: Response) => {
    const strategy = 'gh';
    if (await readAuthCookie(req, strategy)) {
      return res.redirect('/gh');
    }

    const state = await randomHex(8);
    res.cookie(`auth_${strategy}_${state}`, strategy, {
      maxAge: 10 * 60 * 1000,
      httpOnly: true,
      secure,
    });

    const redirectUri = githubAuth.oauth2.authorizationCode.authorizeURL({
      redirect_uri: createRedirectUri(req, strategy),
      scope: 'read:user,repo',
      state,
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
    const code = req.query.code;
    const state = req.query.state;
    const cookieName = `auth_${strategy}_${state}`;
    const cookie = req.cookies && req.cookies[cookieName];
    if (!cookie) {
      // res.redirect(`/${strategy}/login`);
      res.send(
        '<html><body>No cookie for this state. <a href="/gh/login">Retry ?</a></body></html>',
      );
      return;
    }
    res.clearCookie(cookieName);

    const result = await githubAuth.oauth2.authorizationCode.getToken({
      code,
      redirect_uri: createRedirectUri(req, strategy),
    });

    if (!result) {
      // res.redirect(`/${strategy}/login`);
      res.send(
        renderToStaticMarkup(
          <Layout>
            <div>
              Could not get access token. <a href="/gh/login">Retry ?</a>
            </div>
          </Layout>,
        ),
      );
      return;
    }

    const accessToken = result.access_token;
    const octokit = new Octokit({ auth: `token ${accessToken}` });
    const user = await octokit.users.getAuthenticated({});
    const login = user.data.login;

    const token = await signPromisified(
      { login, accessToken, time: Date.now() },
      AUTH_SECRET_KEY,
      {
        algorithm: 'HS512',
        audience: req.headers['user-agent'],
        expiresIn: '10 days',
      },
    );

    res.cookie(`auth_${strategy}`, token, {
      httpOnly: true,
      secure,
    });

    res.redirect('/gh');
  });

  router.get('/gh/repository/:owner/:repository', async (req, res) => {
    const strategy = 'gh';
    const authInfo = await readAuthCookie(req, strategy);
    if (!authInfo) {
      return res.redirect('/gh/login');
    }

    const octokit = new Octokit({ auth: `token ${authInfo.accessToken}` });
    const { data } = await octokit.repos.get({
      owner: req.params.owner,
      repo: req.params.repository,
    });

    if (!data) {
      return res.status(404).send(
        renderToStaticMarkup(
          <Layout>
            <div>repo not found</div>
          </Layout>,
        ),
      );
    }

    if (!data.permissions.admin) {
      return res.status(401).send(
        renderToStaticMarkup(
          <Layout>
            <div>
              not authorized to see this repo, you need to have admin permission
            </div>
          </Layout>,
        ),
      );
    }

    const { data: data2 } = await api.apps
      .getRepoInstallation({
        owner: req.params.owner,
        repo: req.params.repository,
      })
      .catch((err) => {
        return { status: err.status, data: undefined };
      });

    if (!data2) {
      return res.send(
        renderToStaticMarkup(
          <Layout>
            <div>
              {process.env.REVIEWFLOW_NAME} {"isn't"} installed on this repo. Go
              to{' '}
              <a
                href={`https://github.com/apps/${
                  process.env.REVIEWFLOW_NAME
                }/installations/new`}
              >
                Github Configuration
              </a>{' '}
              to add it.
            </div>
          </Layout>,
        ),
      );
    }

    res.send(
      renderToStaticMarkup(
        <Layout>
          <div>
            <h4>{req.params.repository}</h4>
          </div>
        </Layout>,
      ),
    );
  });
}
