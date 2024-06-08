import { promisify } from "node:util";
import { Octokit } from "@octokit/rest";
import type { Router, Request, Response } from "express";
import jsonwebtoken from "jsonwebtoken";
import { renderToStaticMarkup } from "react-dom/server";
import * as githubAuth from "../auth/github";
import Layout from "../views/Layout";

if (!process.env.AUTH_SECRET_KEY) {
  throw new Error("Missing env variable: AUTH_SECRET_KEY");
}

const AUTH_SECRET_KEY: string = process.env.AUTH_SECRET_KEY;

const signPromisified: any = promisify(jsonwebtoken.sign);
const verifyPromisified: any = promisify(jsonwebtoken.verify);

const secure =
  !!process.env.SECURE_COOKIE && process.env.SECURE_COOKIE !== "false";

const createRedirectUri = (req: Request): string => {
  const host = `http${secure ? "s" : ""}://${req.hostname}${
    req.hostname === "localhost" ? `:${process.env.PORT || 3000}` : ""
  }`;
  return `${host}/app/login-response`;
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
): Promise<AuthInfo | undefined> | undefined => {
  const cookie = req.cookies[`auth_${strategy}`];
  if (!cookie) return;

  return verifyPromisified(cookie, AUTH_SECRET_KEY, {
    algorithm: "HS512",
    audience: req.headers["user-agent"],
  });
};

const getAuthInfoFromCookie = async (
  req: Request,
  res: Response,
): Promise<AuthInfo | undefined> => {
  const strategy = "gh"; // req.params.strategy
  try {
    const authInfo = await readAuthCookie(req, strategy);

    if (authInfo?.id) {
      return authInfo;
    }
  } catch {}

  res.clearCookie(`auth_${strategy}`);
  return undefined;
};

function createApi(accessToken: string): Octokit {
  return new Octokit({ auth: accessToken });
}

export const getUser = async (
  req: Request,
  res: Response,
): Promise<{
  authInfo: AuthInfo;
  api: Octokit;
} | null> => {
  const authInfo = await getAuthInfoFromCookie(req, res);
  if (!authInfo) {
    res.redirect("/app/login");
    return null;
  }

  const api = createApi(authInfo.accessToken);

  return {
    authInfo,
    api,
  };
};

export default function auth(router: Router): void {
  router.get(
    "/login",
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    async (req: Request, res: Response, next) => {
      try {
        if (await getAuthInfoFromCookie(req, res)) {
          res.redirect("/app");
          return;
        }

        // const state = await randomHex(8);
        // res.cookie(`auth_${strategy}_${state}`, strategy, {
        //   maxAge: 10 * 60 * 1000,
        //   httpOnly: true,
        //   secure,
        // });

        const redirectUri = githubAuth.oauth2.authorizeURL({
          redirect_uri: createRedirectUri(req),
          scope: "read:user,repo",
          // state,
          // grant_type: options.grantType,
          // access_type: options.accessType,
          // login_hint: req.query.loginHint,
          // include_granted_scopes: options.includeGrantedScopes,
        });

        // console.log(redirectUri);

        res.redirect(redirectUri);
      } catch (error) {
        next(error);
      }
    },
  );

  router.get("/logout", (req, res, next) => {
    try {
      const strategy = "gh";
      res.clearCookie(`auth_${strategy}`, {
        httpOnly: true,
        secure,
      });
      res.send(
        renderToStaticMarkup(
          <Layout>
            <div>
              Logout successful. <a href="/app/login">Login</a>
            </div>
          </Layout>,
        ),
      );
    } catch (error) {
      next(error);
    }
  });

  router.get(
    "/login-response",
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    async (req, res, next) => {
      try {
        if (req.query.error) {
          res.send(req.query.error_description);
          return;
        }

        const strategy = "gh";
        const code: string = req.query.code as string;
        // const state = req.query.state;
        // const cookieName = `auth_${strategy}_${state}`;
        // const cookie = req.cookies && req.cookies[cookieName];
        // if (!cookie) {
        //   // res.redirect(`/${strategy}/login`);
        //   res.send(
        //     '<html><body>No cookie for this state. <a href="/app/login">Retry ?</a></body></html>',
        //   );
        //   return;
        // }
        // res.clearCookie(cookieName);

        const accessToken = await githubAuth.oauth2.getToken({
          code,
          redirect_uri: createRedirectUri(req),
        });

        if (!accessToken) {
          res.send(
            renderToStaticMarkup(
              <Layout>
                <div>
                  Could not get access token. <a href="/app/login">Retry ?</a>
                </div>
              </Layout>,
            ),
          );
          return;
        }

        const api = createApi(accessToken.token.access_token as string);
        const user = await api.users.getAuthenticated({});
        const id = user.data.id;
        const login = user.data.login;

        const authInfo: AuthInfo = {
          id,
          login,
          accessToken: accessToken.token.access_token as string,
          time: Date.now(),
        };
        const token = await signPromisified(authInfo, AUTH_SECRET_KEY, {
          algorithm: "HS512",
          audience: req.headers["user-agent"],
          expiresIn: "10 days",
        });

        res.cookie(`auth_${strategy}`, token, {
          httpOnly: true,
          secure,
        });

        res.redirect("/app");
      } catch (error) {
        next(error);
      }
    },
  );
}
