import { Octokit } from "@octokit/rest";
import type { Request, Response, Router } from "express";
import type { AuthInfo } from "../auth/authCookie.ts";
import {
  authCookieName,
  secureCookie,
  signAuthCookie,
  verifyAuthCookie,
} from "../auth/authCookie.ts";
import * as githubAuth from "../auth/github.ts";
import { webappUrl } from "../webappUrl.ts";

const createRedirectUri = (req: Request): string => {
  const host = `http${secureCookie ? "s" : ""}://${req.hostname}${
    req.hostname === "localhost" ? `:${process.env.PORT || 3000}` : ""
  }`;
  return `${host}/app/login-response`;
};

const getAuthInfoFromCookie = async (
  req: Request,
  res: Response,
): Promise<AuthInfo | undefined> => {
  const cookie: string | undefined = req.cookies[authCookieName];
  if (cookie) {
    const authInfo = await verifyAuthCookie(cookie, req.headers["user-agent"]);
    if (authInfo) return authInfo;
  }

  res.clearCookie(authCookieName, {
    httpOnly: true,
    secure: secureCookie,
    sameSite: "lax",
  });
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

  return {
    authInfo,
    api: createApi(authInfo.accessToken),
  };
};

export default function auth(router: Router): void {
  router.get("/login", async (req: Request, res: Response, next) => {
    try {
      if (await getAuthInfoFromCookie(req, res)) {
        res.redirect(webappUrl("/"));
        return;
      }

      res.redirect(
        githubAuth.oauth2.authorizeURL({
          redirect_uri: createRedirectUri(req),
          scope: "read:user,repo",
        }),
      );
    } catch (error) {
      next(error);
    }
  });

  router.get("/logout", (req, res, next) => {
    try {
      res.clearCookie(authCookieName, {
        httpOnly: true,
        secure: secureCookie,
        sameSite: "lax",
      });
      res.redirect(webappUrl("/", { loggedOut: "1" }));
    } catch (error) {
      next(error);
    }
  });

  router.get("/login-response", async (req, res, next) => {
    try {
      if (req.query.error) {
        res.redirect(
          webappUrl("/", {
            error:
              typeof req.query.error_description === "string"
                ? req.query.error_description
                : "Authentication failed",
          }),
        );
        return;
      }

      const accessToken = await githubAuth.oauth2.getToken({
        code: req.query.code as string,
        redirect_uri: createRedirectUri(req),
      });

      if (!accessToken) {
        res.redirect(webappUrl("/", { error: "Could not get access token" }));
        return;
      }

      const api = createApi(accessToken.token.access_token as string);
      const user = await api.users.getAuthenticated({});

      const token = await signAuthCookie(
        {
          id: user.data.id,
          login: user.data.login,
          accessToken: accessToken.token.access_token as string,
          time: Date.now(),
        },
        req.headers["user-agent"],
      );

      res.cookie(authCookieName, token, {
        httpOnly: true,
        secure: secureCookie,
        sameSite: "lax",
      });

      res.redirect(webappUrl("/"));
    } catch (error) {
      next(error);
    }
  });
}
